import type { PullResponse, PushRequest, PushResponse, SyncDocument, SyncSetting } from '../types'
import type { AccountUser } from '@/services/account/types'
import { ApiError } from '@/services/account/client'
import { decodeBase64Utf8, GitHubApi, GitHubApiError } from './api'
import { GITHUB_BRANCH, GITHUB_DATA_DIR, GITHUB_DEFAULT_REPO_NAME, GITHUB_REPO, resolveRepo } from './config'

/**
 * 用 GitHub 仓库当同步后端。
 *
 * 数据布局（默认在私有仓库 `<login>/md-sync`，目录 `.md-sync`）：
 *   .md-sync/index.json                 游标 + 每个条目的文件路径与更新时间
 *   .md-sync/documents/<name>.json      一篇文章一个文件
 *   .md-sync/settings/<keyHash>.json    一条偏好设置一个文件
 *
 * 每次 push 用 git data API 合成**一个提交**（blob → tree → commit → 更新分支），
 * 一次同步只产生一条历史记录，且内容天然可回溯、可迁移。
 */

interface IndexDocumentEntry {
  path: string
  updatedAt: number
  deleted: boolean
}

interface IndexSettingEntry {
  key: string
  path: string
  updatedAt: number
}

interface SyncIndex {
  version: number
  cursor: number
  documents: Record<string, IndexDocumentEntry>
  settings: Record<string, IndexSettingEntry>
}

interface TreeEntry {
  path: string
  mode: string
  type: string
  sha: string
}

const INDEX_VERSION = 1

function emptyIndex(): SyncIndex {
  return { version: INDEX_VERSION, cursor: 0, documents: {}, settings: {} }
}

/** 文档 id 通常是 uuid，也可能被用户改过；统一收敛成安全的文件名。 */
function safeFileName(raw: string): string {
  const cleaned = raw.replace(/[^\w.-]/g, `_`).slice(0, 80)
  return `${cleaned || `item`}-${stableHash(raw)}`
}

/** 设置项的 key 含 `-`、大小写混杂且可能很长，用哈希做文件名，原 key 存在文件内容里。 */
function stableHash(input: string): string {
  let hash = 0x811C9DC5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, `0`)
}

/** 把 GitHub 的错误映射成统一错误类型，复用现有 UI 的错误文案（401/403/429/413）。 */
function toApiError(error: unknown): never {
  if (error instanceof GitHubApiError)
    throw new ApiError(error.status, error.message, error.body as Record<string, unknown> | undefined)
  throw error
}

/** 账户信息：GitHub 模式下 `/me` 就是 GitHub 的 `/user`。 */
export class GitHubAccountClient {
  private readonly api: GitHubApi

  constructor(getToken: () => string | null) {
    this.api = new GitHubApi(getToken)
  }

  async me(): Promise<AccountUser> {
    try {
      const user = await this.api.getUser()
      return {
        id: String(user.id),
        login: user.login,
        name: user.name,
        avatar: user.avatar_url,
        plan: `free`,
        planExpiresAt: null,
        isAdmin: false,
      }
    }
    catch (error) {
      toApiError(error)
    }
  }
}

export class GitHubSyncClient {
  private readonly api: GitHubApi
  /** 已确认可用的 `owner/repo`，避免每次同步都探一次。 */
  private repo = ``

  constructor(getToken: () => string | null) {
    this.api = new GitHubApi(getToken)
  }

  /**
   * 解析并准备数据仓库：
   * - 显式配置了 `VITE_GITHUB_REPO` → 要求它已存在，否则给出明确报错；
   * - 未配置 → 用 `<登录名>/md-sync`，不存在时自动创建一个私有仓库。
   */
  private async ensureRepo(): Promise<string> {
    if (this.repo)
      return this.repo

    if (GITHUB_REPO) {
      if (!(await this.api.repoExists(GITHUB_REPO)))
        throw new Error(`数据仓库 ${GITHUB_REPO} 不存在或无权访问，请先创建它（建议设为私有）`)
      this.repo = GITHUB_REPO
      return this.repo
    }

    const { login } = await this.api.getUser()
    const target = resolveRepo(login)
    if (await this.api.repoExists(target)) {
      this.repo = target
      return this.repo
    }

    const created = await this.api.createPrivateRepo(GITHUB_DEFAULT_REPO_NAME)
    this.repo = created.full_name
    return this.repo
  }

  private indexPath(): string {
    return `${GITHUB_DATA_DIR}/index.json`
  }

  private async readIndex(repo: string): Promise<SyncIndex> {
    const file = await this.api.getContent(repo, this.indexPath(), GITHUB_BRANCH)
    if (!file)
      return emptyIndex()
    try {
      const parsed = JSON.parse(decodeBase64Utf8(file.content)) as Partial<SyncIndex>
      return {
        version: INDEX_VERSION,
        cursor: Number(parsed.cursor) || 0,
        documents: parsed.documents ?? {},
        settings: parsed.settings ?? {},
      }
    }
    catch {
      return emptyIndex()
    }
  }

  async pull(since: number): Promise<PullResponse> {
    try {
      const repo = await this.ensureRepo()
      const index = await this.readIndex(repo)
      const cursor = Number.isFinite(since) && since > 0 ? since : 0

      const changedDocuments = Object.entries(index.documents)
        .filter(([, entry]) => entry.updatedAt > cursor)
      const changedSettings = Object.entries(index.settings)
        .filter(([, entry]) => entry.updatedAt > cursor)

      const documents = (await Promise.all(
        changedDocuments.map(async ([id, entry]) => {
          const text = await this.readEntry(repo, entry.path)
          if (!text)
            return null
          return { ...(JSON.parse(text) as SyncDocument), id }
        }),
      )).filter((doc): doc is SyncDocument => Boolean(doc))

      const settings = (await Promise.all(
        changedSettings.map(async ([hash, entry]) => {
          const text = await this.readEntry(repo, entry.path)
          if (!text)
            return null
          const setting = JSON.parse(text) as SyncSetting
          return { ...setting, key: entry.key || setting.key || hash }
        }),
      )).filter((setting): setting is SyncSetting => Boolean(setting))

      return { documents, settings, cursor: index.cursor }
    }
    catch (error) {
      toApiError(error)
    }
  }

  async push(payload: PushRequest): Promise<PushResponse> {
    const documents = payload.documents ?? []
    const settings = payload.settings ?? []

    // 两个设备同时写会撞 ref；冲突时重读索引再提交一次。
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const repo = await this.ensureRepo()
        return await this.buildCommit(repo, documents, settings)
      }
      catch (error) {
        const conflict = error instanceof GitHubApiError
          && (error.status === 409 || error.status === 422)
        if (!conflict || attempt === 1)
          toApiError(error)
      }
    }

    throw new ApiError(500, `push failed`)
  }

  private async buildCommit(
    repo: string,
    documents: SyncDocument[],
    settings: SyncSetting[],
  ): Promise<PushResponse> {
    const index = await this.readIndex(repo)

    const head = await this.api.getBranchHead(repo, GITHUB_BRANCH)
    const parentSha = head.object.sha
    const baseTree = await this.api.getCommitTreeSha(repo, parentSha)

    let cursor = index.cursor
    const treeEntries: TreeEntry[] = []

    for (const doc of documents) {
      const path = `${GITHUB_DATA_DIR}/documents/${safeFileName(doc.id)}.json`
      const sha = await this.api.createBlob(repo, JSON.stringify(doc))
      cursor += 1
      treeEntries.push({ path, mode: `100644`, type: `blob`, sha })
      index.documents[doc.id] = { path, updatedAt: cursor, deleted: Boolean(doc.deleted) }
    }

    for (const setting of settings) {
      const hash = stableHash(setting.key)
      const path = `${GITHUB_DATA_DIR}/settings/${hash}.json`
      const body = JSON.stringify({
        key: setting.key,
        value: setting.value,
        updatedAt: setting.updatedAt,
      })
      const sha = await this.api.createBlob(repo, body)
      cursor += 1
      treeEntries.push({ path, mode: `100644`, type: `blob`, sha })
      index.settings[hash] = { key: setting.key, path, updatedAt: cursor }
    }

    if (!treeEntries.length)
      return { documents: [], settings: [], cursor: index.cursor }

    index.cursor = cursor
    const indexSha = await this.api.createBlob(repo, JSON.stringify(index))
    treeEntries.push({ path: this.indexPath(), mode: `100644`, type: `blob`, sha: indexSha })

    const tree = await this.api.createTree(repo, baseTree, treeEntries)
    const commit = await this.api.createCommit(
      repo,
      `md sync: ${documents.length} docs, ${settings.length} settings`,
      tree.sha,
      parentSha,
    )
    await this.api.updateBranchHead(repo, GITHUB_BRANCH, commit.sha)

    return { documents, settings, cursor: index.cursor }
  }

  private async readEntry(repo: string, path: string): Promise<string | null> {
    const file = await this.api.getContent(repo, path, GITHUB_BRANCH)
    return file ? decodeBase64Utf8(file.content) : null
  }
}

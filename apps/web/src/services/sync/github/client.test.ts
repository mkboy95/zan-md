import type { SyncDocument, SyncSetting } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 用一个内存版的 GitHub 替身跑通「推送 → 拉取」往返，
 * 验证游标推进、中文内容编解码、删除标记与自动建仓。
 */

interface FakeRepo {
  trees: Map<string, Map<string, string>>
  commits: Map<string, { tree: string }>
  blobs: Map<string, string>
  refs: Map<string, string>
  autoInit: boolean
}

function createFakeGitHub(options: { seedRepo?: boolean } = {}) {
  const { seedRepo = true } = options
  const repos = new Map<string, FakeRepo>()
  const blobs = new Map<string, string>()
  let counter = 0
  const nextSha = (prefix: string) => `${prefix}${(counter++).toString(16).padStart(6, `0`)}`

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': `application/json` } })

  const notFound = () => json({ message: `Not Found` }, 404)

  const createRepo = (name: string, autoInit: boolean) => {
    const treeSha = nextSha(`tree`)
    const commitSha = nextSha(`commit`)
    const repo: FakeRepo = {
      trees: new Map([[treeSha, new Map()]]),
      commits: new Map([[commitSha, { tree: treeSha }]]),
      blobs,
      refs: new Map(),
      autoInit,
    }
    if (autoInit)
      repo.refs.set(`main`, commitSha)
    repos.set(name, repo)
    return repo
  }

  if (seedRepo)
    createRepo(`me/md-sync`, true)

  async function handle(method: string, url: URL, body: any): Promise<Response> {
    const segments = url.pathname.split(`/`).filter(Boolean)

    if (segments[0] === `user` && method === `GET`)
      return json({ id: 42, login: `me`, name: `维客`, avatar_url: `https://avatar.test/a.png` })

    if (segments[0] === `user` && segments[1] === `repos` && method === `POST`) {
      const repo = createRepo(`me/${body.name}`, true)
      void repo
      return json({ full_name: `me/${body.name}` }, 201)
    }

    if (segments[0] !== `repos`)
      return notFound()

    const repoName = `${segments[1]}/${segments[2]}`
    const repo = repos.get(repoName)
    if (!repo)
      return notFound()

    const rest = segments.slice(3)

    if (rest.length === 0 && method === `GET`)
      return json({ full_name: repoName, private: true })

    // /repos/:o/:r/contents/<path>
    if (rest[0] === `contents`) {
      const path = rest.slice(1).map(decodeURIComponent).join(`/`)
      const commitSha = repo.refs.get(url.searchParams.get(`ref`) ?? `main`)
      if (!commitSha)
        return notFound()
      const tree = repo.trees.get(repo.commits.get(commitSha)!.tree)!
      const blobSha = tree.get(path)
      if (!blobSha)
        return notFound()
      return json({ content: repo.blobs.get(blobSha), sha: blobSha, encoding: `base64` })
    }

    // /repos/:o/:r/git/blobs/<sha>
    if (rest[0] === `git` && rest[1] === `blobs` && rest.length === 3 && method === `GET`) {
      const content = repo.blobs.get(rest[2])
      return content === undefined ? notFound() : json({ content, encoding: `base64` })
    }

    if (rest[0] === `git` && rest[1] === `blobs` && method === `POST`) {
      const sha = nextSha(`blob`)
      repo.blobs.set(sha, body.content)
      return json({ sha }, 201)
    }

    if (rest[0] === `git` && rest[1] === `ref` && rest[2] === `heads` && method === `GET`) {
      const sha = repo.refs.get(decodeURIComponent(rest[3]))
      return sha ? json({ object: { sha } }) : notFound()
    }

    if (rest[0] === `git` && rest[1] === `commits` && rest.length === 3 && method === `GET`) {
      const commit = repo.commits.get(rest[2])
      return commit ? json({ tree: { sha: commit.tree } }) : notFound()
    }

    if (rest[0] === `git` && rest[1] === `trees` && method === `POST`) {
      const base = repo.trees.get(body.base_tree) ?? new Map<string, string>()
      const merged = new Map(base)
      for (const entry of body.tree)
        merged.set(entry.path, entry.sha)
      const sha = nextSha(`tree`)
      repo.trees.set(sha, merged)
      return json({ sha }, 201)
    }

    if (rest[0] === `git` && rest[1] === `commits` && method === `POST`) {
      const sha = nextSha(`commit`)
      repo.commits.set(sha, { tree: body.tree })
      return json({ sha }, 201)
    }

    if (rest[0] === `git` && rest[1] === `refs` && rest[2] === `heads` && method === `PATCH`) {
      repo.refs.set(decodeURIComponent(rest[3]), body.sha)
      return json({ object: { sha: body.sha } })
    }

    return notFound()
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === `string` ? input : input.toString())
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    return handle(init?.method ?? `GET`, url, body)
  })

  return { fetchMock, repos }
}

async function loadClient(env: Record<string, string> = {}) {
  vi.resetModules()
  vi.stubEnv(`VITE_SYNC_BACKEND`, `github`)
  for (const [key, value] of Object.entries(env))
    vi.stubEnv(key, value)
  return import(`./client`)
}

const sampleDocument: SyncDocument = {
  id: `doc-1`,
  title: `维客笔记 · 绿`,
  content: `# 标题\n\n正文里带 **加粗** 和 emoji 🎉，以及引号「」`,
  parentId: null,
  history: [{ datetime: 1700000000000, content: `旧版本` }],
  createDatetime: 1700000000000,
  updateDatetime: 1700000000000,
  deleted: false,
}

describe(`github sync client`, () => {
  let fake: ReturnType<typeof createFakeGitHub>

  beforeEach(() => {
    fake = createFakeGitHub()
    vi.stubGlobal(`fetch`, fake.fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it(`空仓库拉取返回空结果与游标 0`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })
    const client = new GitHubSyncClient(() => `token`)

    const result = await client.pull(0)

    expect(result.documents).toEqual([])
    expect(result.settings).toEqual([])
    expect(result.cursor).toBe(0)
  })

  it(`推送后能原样拉回（含中文与历史）`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })
    const client = new GitHubSyncClient(() => `token`)

    const pushed = await client.push({ documents: [sampleDocument] })
    expect(pushed.cursor).toBe(1)

    const pulled = await client.pull(0)
    expect(pulled.documents).toHaveLength(1)
    expect(pulled.documents[0]).toEqual(sampleDocument)
    expect(pulled.cursor).toBe(1)
  })

  it(`游标推进后不再重复拉取旧内容`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })
    const client = new GitHubSyncClient(() => `token`)

    await client.push({ documents: [sampleDocument] })

    const incremental = await client.pull(1)
    expect(incremental.documents).toEqual([])
    expect(incremental.cursor).toBe(1)
  })

  it(`设置项按游标增量返回`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })
    const client = new GitHubSyncClient(() => `token`)

    const setting: SyncSetting = { key: `md-theme`, value: `weike`, updatedAt: 1700000000000 }
    const pushed = await client.push({ settings: [setting] })
    expect(pushed.cursor).toBe(1)

    const pulled = await client.pull(0)
    expect(pulled.documents).toEqual([])
    expect(pulled.settings).toEqual([setting])
    expect(await client.pull(1)).toMatchObject({ settings: [], cursor: 1 })
  })

  it(`删除标记（墓碑）能同步到另一端`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })
    const client = new GitHubSyncClient(() => `token`)

    await client.push({ documents: [sampleDocument] })
    await client.push({ documents: [{ ...sampleDocument, deleted: true, updateDatetime: 1700000001000 }] })

    const pulled = await client.pull(0)
    expect(pulled.documents).toHaveLength(1)
    expect(pulled.documents[0]!.deleted).toBe(true)
  })

  it(`同一篇文章重复推送只保留一份索引条目`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })
    const client = new GitHubSyncClient(() => `token`)

    await client.push({ documents: [sampleDocument] })
    await client.push({ documents: [{ ...sampleDocument, content: `改过的正文` }] })

    const pulled = await client.pull(0)
    expect(pulled.documents).toHaveLength(1)
    expect(pulled.documents[0]!.content).toBe(`改过的正文`)
  })

  it(`未配置仓库时复用已存在的 <登录名>/md-sync，不重复建仓`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `` })
    const client = new GitHubSyncClient(() => `token`)

    const result = await client.push({ documents: [sampleDocument] })

    expect(result.cursor).toBe(1)
    const created = fake.fetchMock.mock.calls.find(([, init]) => init?.method === `POST` && String(init.body ?? ``).includes(`auto_init`))
    expect(created).toBeUndefined()
  })

  it(`仓库不存在时自动创建私有仓库`, async () => {
    const bare = createFakeGitHub({ seedRepo: false })
    vi.stubGlobal(`fetch`, bare.fetchMock)
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `` })
    const client = new GitHubSyncClient(() => `token`)

    const result = await client.push({ documents: [sampleDocument] })

    expect(result.cursor).toBe(1)
    const created = bare.fetchMock.mock.calls.find(([, init]) => init?.method === `POST` && String(init.body ?? ``).includes(`auto_init`))
    expect(created).toBeTruthy()
    expect(JSON.parse(String(created![1]!.body))).toMatchObject({ name: `md-sync`, private: true })
  })

  it(`显式配置的仓库不存在时给出明确报错`, async () => {
    const bare = createFakeGitHub({ seedRepo: false })
    vi.stubGlobal(`fetch`, bare.fetchMock)
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/nope` })
    const client = new GitHubSyncClient(() => `token`)

    await expect(client.pull(0)).rejects.toThrow(/me\/nope/)
  })

  it(`每次推送只产生一个提交`, async () => {
    const { GitHubSyncClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })
    const client = new GitHubSyncClient(() => `token`)

    const before = fake.fetchMock.mock.calls.length
    await client.push({
      documents: [sampleDocument, { ...sampleDocument, id: `doc-2` }],
      settings: [{ key: `md-theme`, value: `weike`, updatedAt: 1 }],
    })
    const commitCalls = fake.fetchMock.mock.calls
      .slice(before)
      .filter(([url, init]) => init?.method === `POST` && String(url).endsWith(`/git/commits`))

    expect(commitCalls).toHaveLength(1)
  })
})

describe(`github account client`, () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it(`把 GitHub 用户映射成账户信息`, async () => {
    const fake = createFakeGitHub()
    vi.stubGlobal(`fetch`, fake.fetchMock)
    const { GitHubAccountClient } = await loadClient({ VITE_GITHUB_REPO: `me/md-sync` })

    const me = await new GitHubAccountClient(() => `token`).me()

    expect(me).toEqual({
      id: `42`,
      login: `me`,
      name: `维客`,
      avatar: `https://avatar.test/a.png`,
      plan: `free`,
      planExpiresAt: null,
      isAdmin: false,
    })
  })
})

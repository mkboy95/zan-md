/**
 * 极薄的 GitHub REST 封装（只用到 git data + contents 两类接口）。
 *
 * 之所以前端直连 api.github.com，而不是让 Edge Function 代理：
 * 1. GitHub REST 支持浏览器跨域，直连可省掉服务端；
 * 2. EdgeOne Edge Functions 的请求体上限是 1MB，而一篇文章带历史版本后很容易超过；
 * 3. 不占用 EdgeOne 的函数额度。
 */

const API_BASE = `https://api.github.com`
const API_VERSION = `2022-11-28`

export class GitHubApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message)
    this.name = `GitHubApiError`
  }
}

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
}

export interface GitHubContentFile {
  content: string
  sha: string
}

export interface GitHubTreeEntry {
  path: string
  mode: string
  type: string
  sha: string
}

export class GitHubApi {
  constructor(private readonly getToken: () => string | null) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      'accept': `application/vnd.github+json`,
      'x-github-api-version': API_VERSION,
    }
    if (token)
      headers.authorization = `Bearer ${token}`
    if (body !== undefined)
      headers[`content-type`] = `application/json`

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!res.ok) {
      let parsed: { message?: string } | undefined
      try {
        parsed = await res.json() as { message?: string }
      }
      catch { /* 非 JSON 响应 */ }
      throw new GitHubApiError(res.status, parsed?.message || res.statusText, parsed)
    }

    if (res.status === 204)
      return undefined as T

    return res.json() as Promise<T>
  }

  getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>(`GET`, `/user`)
  }

  /** 404 表示仓库不可见或文件不存在，交由调用方区分。 */
  async getContent(repo: string, path: string, branch: string): Promise<GitHubContentFile | null> {
    try {
      const file = await this.request<{ content: string, sha: string, encoding: string }>(
        `GET`,
        `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
      )
      return { content: file.content, sha: file.sha }
    }
    catch (error) {
      if (error instanceof GitHubApiError && error.status === 404)
        return null
      throw error
    }
  }

  async getBlobText(repo: string, sha: string): Promise<string> {
    const blob = await this.request<{ content: string, encoding: string }>(
      `GET`,
      `/repos/${repo}/git/blobs/${sha}`,
    )
    return decodeBase64Utf8(blob.content ?? ``)
  }

  async createBlob(repo: string, text: string): Promise<string> {
    const blob = await this.request<{ sha: string }>(`POST`, `/repos/${repo}/git/blobs`, {
      content: encodeBase64Utf8(text),
      encoding: `base64`,
    })
    return blob.sha
  }

  getBranchHead(repo: string, branch: string): Promise<{ object: { sha: string } }> {
    return this.request<{ object: { sha: string } }>(
      `GET`,
      `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    )
  }

  getCommitTreeSha(repo: string, commitSha: string): Promise<string> {
    return this.request<{ tree: { sha: string } }>(
      `GET`,
      `/repos/${repo}/git/commits/${commitSha}`,
    ).then(commit => commit.tree.sha)
  }

  createTree(
    repo: string,
    baseTree: string,
    entries: GitHubTreeEntry[],
  ): Promise<{ sha: string }> {
    return this.request<{ sha: string }>(`POST`, `/repos/${repo}/git/trees`, {
      base_tree: baseTree,
      tree: entries,
    })
  }

  createCommit(
    repo: string,
    message: string,
    treeSha: string,
    parentSha: string,
  ): Promise<{ sha: string }> {
    return this.request<{ sha: string }>(`POST`, `/repos/${repo}/git/commits`, {
      message,
      tree: treeSha,
      parents: [parentSha],
    })
  }

  updateBranchHead(repo: string, branch: string, sha: string, force = false): Promise<unknown> {
    return this.request(`PATCH`, `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      sha,
      force,
    })
  }

  /** 首次使用时自动建一个私有仓库，省掉手动准备工作。 */
  createPrivateRepo(name: string): Promise<{ full_name: string }> {
    return this.request<{ full_name: string }>(`POST`, `/user/repos`, {
      name,
      private: true,
      auto_init: true,
      description: `Markdown editor cloud sync data`,
    })
  }

  async repoExists(repo: string): Promise<boolean> {
    try {
      await this.request(`GET`, `/repos/${repo}`)
      return true
    }
    catch (error) {
      if (error instanceof GitHubApiError && error.status === 404)
        return false
      throw error
    }
  }
}

function encodePath(path: string): string {
  return path.split(`/`).map(segment => encodeURIComponent(segment)).join(`/`)
}

/** btoa 只接受 latin1，中文内容必须先转字节再分段处理，避免超长参数爆栈。 */
export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ``
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  return btoa(binary)
}

export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ``))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** 同步后端选择：`api` = 仓库自带的 md-api；`github` = 直接读写自己的 GitHub 仓库。 */
export type SyncBackend = `api` | `github`

function readEnv(value: string | undefined): string {
  return (value ?? ``).trim()
}

export const SYNC_BACKEND: SyncBackend
  = readEnv(import.meta.env.VITE_SYNC_BACKEND).toLowerCase() === `github` ? `github` : `api`

export function isGitHubBackend(): boolean {
  return SYNC_BACKEND === `github`
}

/**
 * OAuth 中转地址。默认同源 `/api/auth/github`，即 EdgeOne 的
 * `edge-functions/api/auth/github.js`；本地开发时可指向已部署的站点。
 */
export const GITHUB_OAUTH_BASE = (
  readEnv(import.meta.env.VITE_GITHUB_OAUTH_BASE) || `/api/auth/github`
).replace(/\/+$/, ``)

/** 数据仓库，格式 `owner/repo`。留空则用「登录用户名/md-sync」。 */
export const GITHUB_REPO = readEnv(import.meta.env.VITE_GITHUB_REPO)

/** 数据仓库分支。 */
export const GITHUB_BRANCH = readEnv(import.meta.env.VITE_GITHUB_BRANCH) || `main`

/** 仓库内数据目录；换一个目录即可在同一仓库里开多套互不干扰的数据。 */
export const GITHUB_DATA_DIR = (
  readEnv(import.meta.env.VITE_GITHUB_DATA_DIR) || `.md-sync`
).replace(/^\/+|\/+$/g, ``)

/** 未显式配置仓库时，按登录用户推导默认仓库名。 */
export const GITHUB_DEFAULT_REPO_NAME = `md-sync`

export function resolveRepo(login: string): string {
  if (GITHUB_REPO)
    return GITHUB_REPO
  return `${login}/${GITHUB_DEFAULT_REPO_NAME}`
}

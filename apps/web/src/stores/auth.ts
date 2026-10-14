import type { AccountUser } from '@/services/account/types'
import type { PullResponse, PushRequest, PushResponse } from '@/services/sync/types'
import { t } from '@/i18n/translate'
import { ApiError, MdApiClient } from '@/services/account/client'
import { gotoLogin, isAccountConfigured } from '@/services/account/config'
import {
  canLoginInExtension,
  isExtensionContext,
  loginViaExtensionIdentity,
} from '@/services/account/extension'
import { ACCOUNT_TOKEN_KEY, captureOAuthResult } from '@/services/account/oauth'
import { SyncClient } from '@/services/sync/client'
import { GitHubAccountClient, GitHubSyncClient } from '@/services/sync/github/client'
import { isGitHubBackend } from '@/services/sync/github/config'
import { store } from '@/storage'

/** 账户与同步的两个后端（md-api / 自建 GitHub 仓库）都满足这两个契约。 */
interface AccountApi {
  me: () => Promise<AccountUser>
}

interface SyncApi {
  pull: (since: number) => Promise<PullResponse>
  push: (payload: PushRequest) => Promise<PushResponse>
}

/**
 * Global account store: auth token, JWT, user profile.
 * Cloud sync and other cloud features share this account.
 */
export const useAuthStore = defineStore(`auth`, () => {
  const token = store.reactive(ACCOUNT_TOKEN_KEY, ``)
  const user = ref<AccountUser | null>(null)
  let bootstrapped = false

  const isConfigured = computed(() => isAccountConfigured())
  const isLoggedIn = computed(() => Boolean(token.value))

  const api: AccountApi = isGitHubBackend()
    ? new GitHubAccountClient(() => token.value || null)
    : new MdApiClient(() => token.value || null)
  const syncClient: SyncApi = isGitHubBackend()
    ? new GitHubSyncClient(() => token.value || null)
    : new SyncClient(() => token.value || null)

  /** On startup: capture OAuth redirect token and fetch user profile. */
  async function bootstrap(): Promise<void> {
    if (!isConfigured.value || bootstrapped)
      return
    bootstrapped = true

    const { error } = captureOAuthResult((t) => {
      token.value = t
    })
    if (error === `access_denied`)
      toast.info(t(`account.loginCancelled`))
    else if (error)
      toast.error(t(`account.loginFailed`))

    if (!token.value)
      return

    const ok = await fetchMe()
    // 刚登录时立刻拉一次远端，这样换台设备登录就能直接看到历史文章。
    if (ok && isGitHubBackend())
      await pullAfterLogin()
  }

  async function pullAfterLogin(): Promise<void> {
    try {
      const { useSyncStore } = await import(`@/stores/sync`)
      await useSyncStore().sync()
    }
    catch (error) {
      console.error(`[auth] Initial sync after login failed:`, error)
    }
  }

  async function fetchMe(): Promise<boolean> {
    if (!token.value)
      return false
    try {
      const me = await api.me()
      user.value = {
        ...me,
        plan: me.plan ?? `free`,
        planExpiresAt: me.planExpiresAt ?? null,
        isAdmin: Boolean(me.isAdmin),
      }
      return true
    }
    catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403))
        logout()
      return false
    }
  }

  async function persistDraftsBeforeLogin(): Promise<void> {
    const { useEditorStore } = await import(`@/stores/editor`)
    const { usePostStore } = await import(`@/stores/post`)
    useEditorStore().flushContentToPostStore()
    await usePostStore().persistImmediately()
  }

  async function login(): Promise<void> {
    try {
      await persistDraftsBeforeLogin()
    }
    catch (error) {
      console.error(`[auth] Failed to persist drafts before login:`, error)
    }

    if (isExtensionContext()) {
      if (!canLoginInExtension()) {
        toast.error(t(`account.extensionLoginUnavailable`))
        return
      }

      const result = await loginViaExtensionIdentity()
      if (!result.ok) {
        if (result.reason !== `cancelled`)
          toast.error(t(`account.loginFailed`))
        return
      }

      token.value = result.token
      await store.set(ACCOUNT_TOKEN_KEY, result.token)

      const ok = await fetchMe()
      if (!ok) {
        logout()
        toast.error(t(`account.loginFailed`))
      }
      return
    }

    gotoLogin()
  }

  function logout(): void {
    token.value = ``
    user.value = null
    store.remove(ACCOUNT_TOKEN_KEY).catch(() => {})
  }

  return {
    token,
    user,
    isConfigured,
    isLoggedIn,
    api,
    syncClient,
    bootstrap,
    fetchMe,
    login,
    logout,
  }
})

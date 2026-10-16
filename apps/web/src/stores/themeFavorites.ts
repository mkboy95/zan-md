import type { ThemeName } from '@md/shared/configs'
import { store } from '@/storage'
import { addPrefix } from '@/storage/prefix'

/**
 * Theme favorites (starred themes), persisted to localStorage / IndexedDB.
 *
 * Lets users pin the themes they reach for most often and switch between them
 * from a "收藏" quick zone in the theme picker, without disturbing the full
 * theme list or the active-theme switching logic.
 */
export const useThemeFavoritesStore = defineStore(`themeFavorites`, () => {
  const favorites = store.reactive<ThemeName[]>(addPrefix(`themeFavorites`), [])

  const favoriteSet = computed<Set<ThemeName>>(() => new Set(favorites.value))

  function isFavorite(theme: ThemeName): boolean {
    return favoriteSet.value.has(theme)
  }

  function toggleFavorite(theme: ThemeName): void {
    const current = favorites.value
    favorites.value = current.includes(theme)
      ? current.filter(t => t !== theme)
      : [...current, theme]
  }

  return {
    favorites,
    favoriteSet,
    isFavorite,
    toggleFavorite,
  }
})

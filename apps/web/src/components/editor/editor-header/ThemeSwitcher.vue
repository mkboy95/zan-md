<script setup lang="ts">
import type { ThemeName } from '@md/shared/configs'
import { Check, Palette, Star } from '@lucide/vue'
import { useEditorRefresh } from '@/composables/useEditorRefresh'
import { useLocalizedStyleOptions } from '@/composables/useLocalizedStyleOptions'
import { useThemeStore } from '@/stores/theme'
import { useThemeFavoritesStore } from '@/stores/themeFavorites'

const { t } = useI18n()
const themeStore = useThemeStore()
const favoritesStore = useThemeFavoritesStore()
const localizedStyleOptions = useLocalizedStyleOptions()
const { editorRefresh } = useEditorRefresh()

const { theme } = storeToRefs(themeStore)

// Representative accent color used as a swatch for each built-in theme.
const THEME_DOTS: Record<string, string> = {
  default: '#3b82f6',
  grace: '#8b5cf6',
  simple: '#10b981',
  weike: '#21a675',
  dopamine: '#7c4dff',
  rose: '#a84478',
  orange: '#e8703a',
  ink: '#1a1a1a',
  safflower: '#e8a33d',
  morandi: '#8a8b7f',
  techblue: '#165dff',
  sakura: '#eba0b6',
}

function dotColor(value: string): string {
  return THEME_DOTS[value] ?? 'hsl(var(--primary))'
}

const currentLabel = computed(() =>
  localizedStyleOptions.value.themeOptions.find(o => o.value === theme.value)?.label ?? theme.value,
)

const favoriteOptions = computed(() =>
  localizedStyleOptions.value.themeOptions.filter(o => favoritesStore.isFavorite(o.value)),
)

function switchTheme(next: ThemeName) {
  if (next === theme.value)
    return
  themeStore.theme = next
  themeStore.applyCurrentTheme()
  editorRefresh()
}

function onToggleFavorite(value: ThemeName, event: MouseEvent) {
  // Star button shouldn't also trigger the row's theme switch.
  event.stopPropagation()
  favoritesStore.toggleFavorite(value)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        class="h-9 max-md:w-9 max-md:px-0"
        :aria-label="t('header.theme')"
      >
        <Palette class="h-4 w-4 md:mr-2" />
        <span class="max-md:hidden">{{ currentLabel }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-44 max-h-80 overflow-y-auto">
      <!-- Favorites quick-switch zone -->
      <template v-if="favoriteOptions.length">
        <DropdownMenuLabel class="text-xs text-muted-foreground">
          {{ t('header.favorites') }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="opt in favoriteOptions"
          :key="`fav-${opt.value}`"
          class="flex cursor-pointer items-center gap-2"
          @click="switchTheme(opt.value)"
        >
          <span
            class="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
            :style="{ backgroundColor: dotColor(opt.value) }"
          />
          <span class="flex-1 truncate">{{ opt.label }}</span>
          <Star class="h-4 w-4 text-primary" fill="currentColor" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </template>

      <DropdownMenuItem
        v-for="opt in localizedStyleOptions.themeOptions"
        :key="opt.value"
        class="flex cursor-pointer items-center gap-2"
        @click="switchTheme(opt.value)"
      >
        <span
          class="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
          :style="{ backgroundColor: dotColor(opt.value) }"
        />
        <span class="flex-1 truncate">{{ opt.label }}</span>
        <button
          type="button"
          class="rounded p-0.5 hover:bg-muted"
          :aria-label="favoritesStore.isFavorite(opt.value) ? t('header.unfavorite') : t('header.favorite')"
          @click="onToggleFavorite(opt.value, $event)"
        >
          <Star
            class="h-4 w-4"
            :class="favoritesStore.isFavorite(opt.value) ? 'text-primary' : 'text-muted-foreground'"
            :fill="favoritesStore.isFavorite(opt.value) ? 'currentColor' : 'none'"
          />
        </button>
        <Check v-if="opt.value === theme" class="h-4 w-4 text-primary" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

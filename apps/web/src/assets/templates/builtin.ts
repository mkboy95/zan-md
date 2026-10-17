import type { Template } from '@md/shared'
import emeraldOrigin from '../example/emerald-original.md?raw'

/**
 * Templates that ship with the app.
 *
 * A built-in template can pin a layout theme (`theme`): applying it switches the
 * editor to that theme, so a verbatim HTML article never lands inside another
 * theme's card (the "card in a card" bug).
 */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: `builtin-emerald-origin`,
    name: `祖母绿 · 原版复刻`,
    description: `公众号「工具评测」原版排版：封面卡片 + PART 横滑目录 + 白底正文`,
    content: emeraldOrigin,
    theme: `emerald-origin`,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
    tags: [`祖母绿`, `公众号`],
  },
]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { perThemeDefaultSettings, themeMap } from './index'
import { themeOptions, themeOptionsMap } from './theme'

/**
 * Guards for the five template themes added alongside 超赞绿:
 * dopamine / rose / orange / ink / safflower.
 *
 * Theme files are read from disk: vitest's SSR mode returns empty strings for
 * `?raw` imports (see zanGreen.test.ts), so `themeMap` cannot be trusted here
 * for file content — only for key presence.
 */

const themeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../../shared/src/configs/theme-css`)
const readTheme = (file: string) => fs.readFileSync(path.join(themeDir, file), `utf-8`)

interface TemplateTheme {
  id: string
  file: string
  /**
   * The theme's own accent, lowercase hex. It must NOT appear in the stylesheet:
   * themes describe structure, colour comes from the theme-colour picker via
   * `var(--md-primary-*)`. See configs/primaryPalette.ts.
   */
  accent: string
  /** Primary colour the per-theme defaults must resolve to. */
  primaryColor: string
}

const templates: TemplateTheme[] = [
  { id: `dopamine`, file: `dopamine.css`, accent: `#7c4dff`, primaryColor: `#7C4DFF` },
  { id: `rose`, file: `rose.css`, accent: `#a84478`, primaryColor: `#A84478` },
  { id: `orange`, file: `orange.css`, accent: `#e8703a`, primaryColor: `#E8703A` },
  { id: `ink`, file: `ink.css`, accent: `#1a1a1a`, primaryColor: `#1A1A1A` },
  { id: `safflower`, file: `safflower.css`, accent: `#e8a33d`, primaryColor: `#E8A33D` },
  { id: `morandi`, file: `morandi.css`, accent: `#8a8b7f`, primaryColor: `#8A8B7F` },
  { id: `techblue`, file: `techblue.css`, accent: `#165dff`, primaryColor: `#165DFF` },
  { id: `sakura`, file: `sakura.css`, accent: `#eba0b6`, primaryColor: `#EBA0B6` },
  { id: `emerald`, file: `emerald.css`, accent: `#059669`, primaryColor: `#059669` },
  { id: `emerald-origin`, file: `emerald-origin.css`, accent: `#059669`, primaryColor: `#059669` },
  { id: `journal`, file: `journal.css`, accent: `#1f3a5f`, primaryColor: `#1F3A5F` },
  { id: `notecard`, file: `notecard.css`, accent: `#d97706`, primaryColor: `#D97706` },
]

describe.each(templates)(`$id template theme`, ({ id, file, accent, primaryColor }) => {
  const css = readTheme(file)
  // Strip comments first: the header notes mention `color-mix()` when stating
  // the "we don't use it" rule, which would false-positive the check below.
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ``)

  it(`is registered in themeMap`, () => {
    expect(Object.keys(themeMap)).toContain(id)
  })

  it(`starts from its own accent colour`, () => {
    expect(perThemeDefaultSettings(id as never).primaryColor).toBe(primaryColor)
  })

  it(`never hard-codes its accent: colour comes from the theme-colour picker`, () => {
    // Themes own the structure; every wash/edge/gradient is derived at runtime
    // from --md-primary-color, so switching the colour repaints the whole article.
    expect(css).toContain(`var(--md-primary-`)
    // Comments may still name the signature colour; the rules themselves must not.
    expect(cssWithoutComments.toLowerCase()).not.toContain(accent)
  })

  it(`uses a block-level h1 whose rule spans the full width`, () => {
    // The rule (border-bottom or a background rule) must sit on h1 itself.
    // Painting it on the inline <span> shrinks it to the text width — that bug
    // is what made an earlier 超赞绿 build lose its full-width underline.
    expect(css).toMatch(/h1\s*\{[^}]*display:\s*block/)
    expect(css).toMatch(/h1\s*\{[^}]*(border-bottom:|background-image:|background-size:)/)
    expect(css).not.toMatch(/h1\s*>\s*span\s*\{[^}]*border-bottom:/)
  })

  it(`keeps WeChat compatibility: no color-mix, no pseudo-element content`, () => {
    expect(cssWithoutComments).not.toContain(`color-mix(`)
    expect(cssWithoutComments).not.toMatch(/::(before|after)\s*\{[^}]*content:/)
  })

  it(`scales spacing with the block-spacing variable`, () => {
    expect(css).toContain(`var(--md-block-spacing)`)
  })

  it(`carries no leftover generic blue`, () => {
    expect(css).not.toContain(`#0F4C81`)
    expect(css).not.toContain(`#576b95`)
  })
})

describe(`template theme registration`, () => {
  it(`registers all five ids in themeOptions order`, () => {
    // theme.ts exports both a map and an ordered list; both must stay in sync.
    const ids = themeOptions.map(o => o.value)
    for (const t of templates)
      expect(ids).toContain(t.id)
    for (const t of templates)
      expect(themeOptionsMap[t.id as keyof typeof themeOptionsMap].value).toBe(t.id)
  })
})

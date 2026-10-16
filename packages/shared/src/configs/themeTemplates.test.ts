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
  /** Signature accent colour, lowercase hex as written in the CSS. */
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

  it(`uses its accent colour in the stylesheet`, () => {
    expect(css).toContain(accent)
  })

  it(`paints the h1 as a block heading with a full-width rule and a span ribbon`, () => {
    // Same three-part structure as 超赞绿: h1 block-level + border-bottom rule,
    // ribbon on the inner span (the renderer wraps h1 text in a <span>).
    expect(css).toMatch(/h1\s*\{[^}]*display:\s*block/)
    expect(css).toMatch(/h1\s*\{[^}]*border-bottom:[^;]*(solid|transparent)/)
    expect(css).toMatch(/h1\s*>\s*span\s*\{[^}]*display:\s*inline-block/)
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

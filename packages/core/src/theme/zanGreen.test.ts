import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { perThemeDefaultSettings } from '@md/shared/configs'
import { describe, expect, it } from 'vitest'
import { processCSS } from './cssProcessor'
import { generateCSSVariables } from './cssVariables'

/**
 * End-to-end CSS check for the 超赞绿 (weike) theme: the merged stylesheet the
 * app injects must paint headings and accents with the theme's own green, not
 * the generic blue that shipped before per-theme defaults existed.
 *
 * The theme files are read from disk (vitest's SSR mode returns empty strings
 * for `?raw` CSS imports, so importing themeMap here would test nothing).
 */
const themeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../../shared/src/configs/theme-css`)
const raw = (file: string) => fs.readFileSync(path.join(themeDir, file), `utf-8`)

const settings = perThemeDefaultSettings(`weike`)
const mergedCSS = processCSS([
  generateCSSVariables(settings),
  raw(`base.css`),
  raw(`default.css`),
  raw(`weike.css`),
].join(`\n\n`))

/** Body of the last rule for a selector — the one that wins the cascade. */
function lastRule(css: string, selector: string): string {
  const bodies = [...css.matchAll(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, `g`))].map(m => m[1])
  return bodies.length > 0 ? bodies[bodies.length - 1] : ``
}

describe(`超赞绿 theme composition`, () => {
  it(`loads the real theme files`, () => {
    expect(raw(`weike.css`)).toContain(`--md-primary-color`)
    expect(raw(`default.css`).length).toBeGreaterThan(1000)
  })

  it(`emits the theme's green as the primary colour`, () => {
    expect(mergedCSS).toContain(`--md-primary-color: #21A675`)
  })

  it(`paints the h1 ribbon, h2 text and h3 bar green`, () => {
    // h1 itself is block-level with the full-width rule; the ribbon lives on the inner span
    expect(lastRule(mergedCSS, `h1`)).toMatch(/border-bottom:[^;]*#21A675/)
    expect(lastRule(mergedCSS, `h1`)).toContain(`display: block`)
    expect(lastRule(mergedCSS, `h1 > span`)).toContain(`background-color: #21A675`)
    expect(lastRule(mergedCSS, `h2`)).toContain(`color: #21A675`)
    expect(lastRule(mergedCSS, `h3`)).toMatch(/border-left:[^;]*#21A675/)
  })

  it(`keeps the h1 rule full-width, not shrink-wrapped to the ribbon`, () => {
    // Regression: the rule used to live on an inline-block h1, so it only
    // spanned the ribbon width and looked like it had disappeared.
    expect(lastRule(mergedCSS, `h1`)).toContain(`display: block`)
    expect(lastRule(mergedCSS, `h1 > span`)).toContain(`display: inline-block`)
  })

  it(`leaves no generic blue behind in the themed output`, () => {
    expect(mergedCSS).not.toContain(`#0F4C81`)
  })

  it(`uses the serif stack the design was ported with`, () => {
    expect(mergedCSS).toContain(`--md-font-family: Optima-Regular`)
  })
})

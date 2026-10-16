import { describe, expect, it } from 'vitest'
import { buildPrimaryPalette, generatePrimaryPaletteCSS, parseColor, resolvePrimaryPaletteVars } from './primaryPalette'

/**
 * The palette is what lets the theme-colour button repaint an entire article:
 * themes reference `var(--md-primary-*)` for washes, card edges and gradients,
 * and the export pipeline resolves them back to literals for WeChat.
 */

describe(`parseColor`, () => {
  it(`reads 6-digit hex`, () => {
    expect(parseColor(`#059669`)).toEqual({ r: 5, g: 150, b: 105 })
  })

  it(`reads 3-digit hex`, () => {
    expect(parseColor(`#0f0`)).toEqual({ r: 0, g: 255, b: 0 })
  })

  it(`reads rgb() and rgba()`, () => {
    expect(parseColor(`rgb(5, 150, 105)`)).toEqual({ r: 5, g: 150, b: 105 })
    expect(parseColor(`rgba(5, 150, 105, 0.5)`)).toEqual({ r: 5, g: 150, b: 105 })
  })

  it(`returns null for unparseable input`, () => {
    expect(parseColor(`var(--md-primary-color)`)).toBeNull()
    expect(parseColor(`rebeccapurple`)).toBeNull()
    expect(parseColor(``)).toBeNull()
  })
})

describe(`buildPrimaryPalette`, () => {
  const palette = buildPrimaryPalette(`#059669`)

  it(`derives translucent washes from the picked colour`, () => {
    expect(palette.tint).toBe(`rgba(5, 150, 105, 0.07)`)
    expect(palette.soft).toBe(`rgba(5, 150, 105, 0.12)`)
    expect(palette.edge).toBe(`rgba(5, 150, 105, 0.16)`)
  })

  it(`darkens the ink so text stays readable on washes`, () => {
    // #059669 mixed 30% toward black
    expect(palette.ink).toBe(`#04694a`)
  })

  it(`keeps alpha ordering: fade < tint < soft < wash`, () => {
    const alpha = (value: string) => Number.parseFloat(value.slice(value.lastIndexOf(`,`) + 1))
    expect(alpha(palette.fade)).toBeLessThan(alpha(palette.tint))
    expect(alpha(palette.tint)).toBeLessThan(alpha(palette.soft))
    expect(alpha(palette.soft)).toBeLessThan(alpha(palette.wash))
  })

  it(`falls back to a neutral accent instead of throwing`, () => {
    const fallback = buildPrimaryPalette(`not-a-colour`)
    expect(fallback.tint).toBe(`rgba(15, 76, 129, 0.07)`)
  })
})

describe(`generatePrimaryPaletteCSS`, () => {
  it(`declares every derived variable under :root`, () => {
    const css = generatePrimaryPaletteCSS(`#059669`)
    for (const name of [`--md-primary-ink`, `--md-primary-tint`, `--md-primary-soft`, `--md-primary-wash`, `--md-primary-edge`, `--md-primary-line`, `--md-primary-fade`, `--md-primary-halo`])
      expect(css).toContain(`${name}: `)
  })
})

describe(`resolvePrimaryPaletteVars`, () => {
  it(`replaces derived vars with literals for WeChat`, () => {
    const resolved = resolvePrimaryPaletteVars(
      `background: var(--md-primary-tint); border: 1px solid var(--md-primary-edge);`,
      `#059669`,
    )
    expect(resolved).toBe(`background: rgba(5, 150, 105, 0.07); border: 1px solid rgba(5, 150, 105, 0.16);`)
  })

  it(`resolves --md-primary-color to the picked colour`, () => {
    expect(resolvePrimaryPaletteVars(`color: var(--md-primary-color);`, `#ff0000`))
      .toBe(`color: #ff0000;`)
  })

  it(`leaves unrelated vars untouched`, () => {
    const input = `font-size: calc(var(--md-font-size) * 1.5);`
    expect(resolvePrimaryPaletteVars(input, `#059669`)).toBe(input)
  })
})

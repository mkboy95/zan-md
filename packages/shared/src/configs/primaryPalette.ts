/**
 * Primary colour palette derivation.
 *
 * Built-in themes describe **structure** (cards, heading shapes, spacing);
 * colour is owned by the theme-colour button. A single `--md-primary-color`
 * is not enough for that: cards need translucent washes, tinted section bars,
 * gradient rules and a darker ink for text sitting on those washes.
 *
 * `buildPrimaryPalette` derives all of them from the picked colour, so switching
 * the theme colour repaints the whole article instead of only the accents that
 * happened to be written as `var(--md-primary-color)`.
 */

export interface RGB {
  r: number
  g: number
  b: number
}

/** CSS variable names injected alongside `--md-primary-color`. */
export const PRIMARY_PALETTE_VARS = {
  ink: `--md-primary-ink`,
  tint: `--md-primary-tint`,
  soft: `--md-primary-soft`,
  wash: `--md-primary-wash`,
  edge: `--md-primary-edge`,
  line: `--md-primary-line`,
  fade: `--md-primary-fade`,
  halo: `--md-primary-halo`,
} as const

export type PrimaryPaletteKey = keyof typeof PRIMARY_PALETTE_VARS

export type PrimaryPalette = Record<PrimaryPaletteKey, string>

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const RGB_PATTERN = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i

/** Neutral fallback when the configured colour cannot be parsed. */
const FALLBACK_RGB: RGB = { r: 15, g: 76, b: 129 }

function clampChannel(value: number): number {
  if (!Number.isFinite(value))
    return 0
  return Math.max(0, Math.min(255, Math.round(value)))
}

/** Parse `#rgb` / `#rrggbb` / `rgb()` / `rgba()`; returns null for anything else. */
export function parseColor(input: string): RGB | null {
  const value = input.trim()

  const hex = HEX_PATTERN.exec(value)
  if (hex) {
    const raw = hex[1]!
    if (raw.length === 3) {
      return {
        r: Number.parseInt(raw[0]! + raw[0]!, 16),
        g: Number.parseInt(raw[1]! + raw[1]!, 16),
        b: Number.parseInt(raw[2]! + raw[2]!, 16),
      }
    }
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
    }
  }

  const rgb = RGB_PATTERN.exec(value)
  if (rgb) {
    return {
      r: clampChannel(Number(rgb[1])),
      g: clampChannel(Number(rgb[2])),
      b: clampChannel(Number(rgb[3])),
    }
  }

  return null
}

function toHex({ r, g, b }: RGB): string {
  const hex = (channel: number): string => clampChannel(channel).toString(16).padStart(2, `0`)
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** Mix toward black (amount > 0) or white (amount < 0). */
function shade(rgb: RGB, amount: number): string {
  const target = amount > 0 ? 0 : 255
  const ratio = Math.abs(amount)
  return toHex({
    r: rgb.r + (target - rgb.r) * ratio,
    g: rgb.g + (target - rgb.g) * ratio,
    b: rgb.b + (target - rgb.b) * ratio,
  })
}

export function buildPrimaryPalette(primaryColor: string): PrimaryPalette {
  const rgb = parseColor(primaryColor) ?? FALLBACK_RGB
  const rgba = (alpha: number): string => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`

  return {
    // Darker ink so text stays readable on tinted washes.
    ink: shade(rgb, 0.3),
    // Card fills / section bars.
    tint: rgba(0.07),
    // Pills, inline code.
    soft: rgba(0.12),
    // Marker highlights.
    wash: rgba(0.2),
    // Hairline borders around cards.
    edge: rgba(0.16),
    // Gradient start (rules, link underlines).
    line: rgba(0.35),
    // Gradient end.
    fade: rgba(0.03),
    // Soft glow behind pills and featured blocks.
    halo: rgba(0.28),
  }
}

/** `:root` declarations for the derived palette. */
export function generatePrimaryPaletteCSS(primaryColor: string): string {
  const palette = buildPrimaryPalette(primaryColor)
  const keys = Object.keys(PRIMARY_PALETTE_VARS) as PrimaryPaletteKey[]
  return keys.map(key => `  ${PRIMARY_PALETTE_VARS[key]}: ${palette[key]};`).join(`\n`)
}

/**
 * Replace `var(--md-primary-*)` references with literal colours.
 * WeChat strips `:root`, so exported HTML must carry resolved values.
 */
export function resolvePrimaryPaletteVars(css: string, primaryColor: string): string {
  const palette = buildPrimaryPalette(primaryColor)
  return css.replace(/var\(--md-primary-([a-z]+)\)/g, (_match, rawKey: string) => {
    const key = rawKey as PrimaryPaletteKey
    if (rawKey === `color`)
      return primaryColor
    return palette[key] ?? primaryColor
  })
}

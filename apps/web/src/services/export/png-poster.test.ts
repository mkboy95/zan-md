import { describe, expect, it } from 'vitest'
import {
  computePosterPixelRatio,
  POSTER_MAX_CANVAS_AREA,
  POSTER_MAX_CANVAS_DIMENSION,
  POSTER_MIN_PIXEL_RATIO,
} from './png-poster'

describe(`computePosterPixelRatio`, () => {
  it(`prefers a crisp 2x render for short content`, () => {
    const result = computePosterPixelRatio({ width: 750, height: 1200, devicePixelRatio: 1 })
    expect(result).toEqual({ pixelRatio: 2, fits: true, downscaled: false })
  })

  it(`never exceeds the requested device pixel ratio`, () => {
    const result = computePosterPixelRatio({ width: 750, height: 1200, devicePixelRatio: 3 })
    expect(result.pixelRatio).toBe(3)
    expect(result.fits).toBe(true)
  })

  it(`downscales below 1x to keep a tall article on a single canvas`, () => {
    // Height bound: 16384 / 20000 = 0.8192
    const result = computePosterPixelRatio({ width: 750, height: 20_000, devicePixelRatio: 2 })
    expect(result.fits).toBe(true)
    expect(result.downscaled).toBe(true)
    expect(result.pixelRatio).toBeCloseTo(0.82, 2)
  })

  it(`respects the canvas area limit`, () => {
    // Area bound with a small ceiling: sqrt(1_000_000 / (750 * 1200)) ≈ 1.054
    const result = computePosterPixelRatio({
      width: 750,
      height: 1200,
      devicePixelRatio: 2,
      maxArea: 1_000_000,
    })
    expect(result.pixelRatio).toBeCloseTo(1.05, 2)
    expect(result.fits).toBe(true)
  })

  it(`gives up (fits=false) when even the minimum scale overflows`, () => {
    // Height bound: 16384 / 40000 = 0.4096 < 0.5
    const result = computePosterPixelRatio({ width: 750, height: 40_000, devicePixelRatio: 2 })
    expect(result.fits).toBe(false)
    expect(result.pixelRatio).toBe(POSTER_MIN_PIXEL_RATIO)
  })

  it(`clamps an over-wide capture to the dimension limit`, () => {
    const result = computePosterPixelRatio({ width: 40_000, height: 1000, devicePixelRatio: 2 })
    expect(result.fits).toBe(false)
    expect(result.pixelRatio).toBe(POSTER_MIN_PIXEL_RATIO)
  })

  it(`handles empty/NaN dimensions without throwing`, () => {
    expect(computePosterPixelRatio({ width: 0, height: 100, devicePixelRatio: 2 }).fits).toBe(false)
    expect(computePosterPixelRatio({ width: 100, height: 0, devicePixelRatio: 2 }).fits).toBe(false)
    expect(computePosterPixelRatio({ width: Number.NaN, height: 100, devicePixelRatio: 2 }).fits).toBe(false)
  })

  it(`falls back to sane defaults when no limits are provided`, () => {
    const result = computePosterPixelRatio({ width: 375, height: 375, devicePixelRatio: 1 })
    expect(result.pixelRatio).toBe(2)
    expect(result.fits).toBe(true)
  })

  it(`exposes the documented canvas limits as constants`, () => {
    expect(POSTER_MAX_CANVAS_DIMENSION).toBe(16_384)
    expect(POSTER_MAX_CANVAS_AREA).toBe(16_777_216)
  })
})

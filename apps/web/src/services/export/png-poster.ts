import type { PreviewDevice } from './png-capture'
import { sanitizeTitle } from '@md/shared/utils/basicHelpers'
import { downloadFile } from '@md/shared/utils/fileHelpers'
import { delay } from '@/lib/delay'
import { waitForPreviewReady } from '@/lib/preview/preview-ready'
import { getPngCaptureBackgroundColor } from './apply-export-layout'
import { createOffScreenPreview } from './png-capture'
import { DEFAULT_PNG_SEGMENT_HEIGHT, exportPNGSegments } from './png-segments'

/**
 * Long-image / poster export.
 *
 * Renders the whole article as a single tall portrait PNG — the format that
 * suits 小红书-style posting. It reuses the off-screen capture clone from
 * `png-capture.ts`, then decides a safe device pixel ratio so the resulting
 * canvas stays inside the browser's limits. When even a 0.5× render would
 * overflow, the export degrades to the split-image pipeline
 * (`exportPNGSegments`) rather than failing.
 *
 * `computePosterPixelRatio` is pure so it can be unit-tested without a layout
 * engine or canvas.
 */

/**
 * Conservative ceiling for a single canvas edge. Chrome allows 32767, but iOS
 * Safari historically caps lower, so we stay well inside the safe range.
 */
export const POSTER_MAX_CANVAS_DIMENSION = 16_384

/** Conservative ceiling for total canvas area (Safari ~16.7M px). */
export const POSTER_MAX_CANVAS_AREA = 16_777_216

/** Lowest scale we will shrink to before giving up on a single image. */
export const POSTER_MIN_PIXEL_RATIO = 0.5

/** Preferred crispness on short articles (≈ Retina 2×). */
export const POSTER_IDEAL_PIXEL_RATIO = 2

export interface PosterScaleInput {
  /** Content width in CSS pixels. */
  width: number
  /** Content height in CSS pixels. */
  height: number
  /** `window.devicePixelRatio`. */
  devicePixelRatio: number
  maxDimension?: number
  maxArea?: number
}

export interface PosterScaleResult {
  /** Device pixel ratio to capture with. */
  pixelRatio: number
  /** False when no single canvas can hold the content — caller degrades. */
  fits: boolean
  /** True when the render had to be scaled below 1× to fit. */
  downscaled: boolean
}

/**
 * Pick the largest device pixel ratio that keeps a `width × height` capture
 * inside the canvas limits, bounded by the ideal ratio.
 *
 * Exported for tests: it is the whole "does this fit on one canvas?" decision.
 */
export function computePosterPixelRatio(input: PosterScaleInput): PosterScaleResult {
  const maxDimension = input.maxDimension ?? POSTER_MAX_CANVAS_DIMENSION
  const maxArea = input.maxArea ?? POSTER_MAX_CANVAS_AREA
  const { width, height } = input

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { pixelRatio: POSTER_MIN_PIXEL_RATIO, fits: false, downscaled: true }
  }

  const desired = Math.max(input.devicePixelRatio || 1, POSTER_IDEAL_PIXEL_RATIO)
  const limit = Math.min(
    desired,
    maxDimension / width,
    maxDimension / height,
    Math.sqrt(maxArea / (width * height)),
  )

  if (!Number.isFinite(limit) || limit < POSTER_MIN_PIXEL_RATIO)
    return { pixelRatio: POSTER_MIN_PIXEL_RATIO, fits: false, downscaled: true }

  const pixelRatio = Math.round(limit * 100) / 100
  return { pixelRatio, fits: true, downscaled: pixelRatio < 1 }
}

export interface ExportPNGPosterOptions {
  previewDevice: PreviewDevice
  /** Prepend a title / cover band above the article. Defaults to true. */
  showCover?: boolean
  /** Cover text; falls back to the article title. */
  coverTitle?: string
  /** Segment height used when the content must degrade to split images. */
  fallbackSegmentHeight?: number
  onProgress?: (done: number, total: number) => void
}

export type PosterExportMode = `poster` | `segments`

export interface PosterExportResult {
  /** Images written (1 for a poster, N for the segmented fallback). */
  count: number
  mode: PosterExportMode
  /** True when the poster had to be rendered below 1×. */
  downscaled: boolean
}

function getPosterCaptureOptions(pixelRatio: number) {
  return {
    backgroundColor: getPngCaptureBackgroundColor(),
    skipFonts: true,
    pixelRatio,
    style: { margin: `0` },
  }
}

/** Prepend a centered title band so the cover reads well in a feed. */
function injectPosterCover(preview: HTMLElement, content: HTMLElement, title: string) {
  const text = title.trim()
  if (!text)
    return

  const cover = document.createElement(`section`)
  cover.setAttribute(`data-poster-cover`, ``)
  cover.style.cssText = [
    `box-sizing: border-box`,
    `padding: 48px 32px 40px`,
    `text-align: center`,
    `border-bottom: 1px solid rgba(128, 128, 128, 0.2)`,
    `margin-bottom: 24px`,
  ].join(`;`)

  const heading = document.createElement(`h1`)
  heading.textContent = text
  heading.style.cssText = [
    `margin: 0`,
    `font-size: 30px`,
    `line-height: 1.35`,
    `font-weight: 700`,
    `word-break: break-word`,
  ].join(`;`)

  cover.appendChild(heading)
  preview.insertBefore(cover, content)
}

function downloadPngBlob(blob: Blob, title: string) {
  const url = URL.createObjectURL(blob)
  try {
    downloadFile(url, `${sanitizeTitle(title)}.png`, `image/png`)
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Export the preview as a single tall portrait image.
 *
 * @returns how many images were produced and which pipeline ran; `count` is 0
 *   when there was nothing to export.
 */
export async function exportPNGPoster(
  title: string = `untitled`,
  options: ExportPNGPosterOptions,
): Promise<PosterExportResult> {
  await waitForPreviewReady()

  const offScreen = await createOffScreenPreview(options.previewDevice)
  if (!offScreen)
    return { count: 0, mode: `poster`, downscaled: false }

  let fallbackToSegments = false
  let downscaled = false

  try {
    await delay(100)

    if (options.showCover !== false)
      injectPosterCover(offScreen.el, offScreen.content, options.coverTitle ?? title)

    const rect = offScreen.el.getBoundingClientRect()
    const scale = computePosterPixelRatio({
      width: rect.width,
      height: rect.height,
      devicePixelRatio: window.devicePixelRatio || 1,
    })
    downscaled = scale.downscaled

    if (!scale.fits) {
      fallbackToSegments = true
    }
    else {
      const { toBlob } = await import(`html-to-image`)
      const blob = await toBlob(offScreen.el, getPosterCaptureOptions(scale.pixelRatio))
      if (!blob)
        return { count: 0, mode: `poster`, downscaled }

      downloadPngBlob(blob, title)
      return { count: 1, mode: `poster`, downscaled }
    }
  }
  finally {
    offScreen.cleanup()
  }

  // One canvas cannot hold the article even scaled down: split it on block
  // boundaries instead, the exact case the segmented pipeline exists for.
  if (fallbackToSegments) {
    const count = await exportPNGSegments(title, {
      previewDevice: options.previewDevice,
      maxSegmentHeight: options.fallbackSegmentHeight ?? DEFAULT_PNG_SEGMENT_HEIGHT,
      onProgress: options.onProgress,
    })
    return { count, mode: `segments`, downscaled }
  }

  return { count: 0, mode: `poster`, downscaled }
}

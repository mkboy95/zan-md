import type { MarkedExtension } from 'marked'

/**
 * Image gallery.
 *
 * When applied to the full rendered document, 2+ consecutive standalone images
 * (adjacent blocks that each contain only an image) are wrapped in a
 * WeChat-safe responsive grid:
 *   - `display: flex; flex-wrap: wrap` on the wrapper
 *   - children at `width: 50%` (2-up) or `width: 33.33%` (3-up, for 3+ images)
 *   - a small `gap` between cells
 *
 * A single image is never wrapped, so it keeps its original width. The wrapper
 * styles live in `base.css` (scoped via `.md-image-gallery`), keeping the output
 * WeChat-safe (no `color-mix()`, no pseudo-element content).
 *
 * Implemented as a post-render transform (see `wrapImageGalleries`) applied once
 * on the whole document, rather than a marked hook, so it never runs on the
 * per-inline sub-parses that marked performs while rendering paragraphs.
 */

const FIGURE_REGEX = /<figure\b[^>]*>[\s\S]*?<\/figure>/g

/** Only whitespace (no other block content) may sit between two figures in a run. */
const GAP_REGEX = /^\s*$/

interface FigureRun {
  start: number
  end: number
  count: number
}

/**
 * Group maximal runs of consecutive top-level figures. Two figures belong to the
 * same run only when everything between them is whitespace — so a paragraph of
 * text, or any other block, breaks the run.
 */
function findRuns(html: string, matches: RegExpMatchArray[]): FigureRun[] {
  const runs: FigureRun[] = []
  let runStart = -1
  let runEnd = -1
  let prevEnd = -1
  let count = 0

  for (const match of matches) {
    const start = match.index ?? 0
    const end = start + match[0].length

    if (prevEnd >= 0 && !GAP_REGEX.test(html.slice(prevEnd, start))) {
      if (count >= 2)
        runs.push({ start: runStart, end: runEnd, count })
      runStart = -1
      runEnd = -1
      count = 0
    }

    if (runStart < 0)
      runStart = start
    runEnd = end
    prevEnd = end
    count++
  }

  if (count >= 2)
    runs.push({ start: runStart, end: runEnd, count })

  return runs
}

/** Wrap maximal runs of 2+ consecutive top-level figures in a responsive grid. */
export function wrapImageGalleries(html: string): string {
  const matches = Array.from(html.matchAll(FIGURE_REGEX))
  if (matches.length < 2)
    return html

  const runs = findRuns(html, matches)
  if (runs.length === 0)
    return html

  let result = ``
  let cursor = 0
  for (const run of runs) {
    result += html.slice(cursor, run.start)
    const inner = html.slice(run.start, run.end)
    const cols = run.count >= 3 ? 3 : 2
    result += `<section class="md-image-gallery" data-cols="${cols}">${inner}</section>`
    cursor = run.end
  }
  result += html.slice(cursor)

  return result
}

/** Marked-extension wrapper kept for API symmetry; the transform is applied via `wrapImageGalleries`. */
export function markedImageGallery(): MarkedExtension {
  return {}
}

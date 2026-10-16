/**
 * 小红书 (Xiaohongshu / RED) export adapter.
 *
 * Xiaohongshu is a feed built around vertical long images plus a short caption.
 * This adapter therefore reuses the existing poster pipeline
 * ({@link exportPNGPoster}) for the cover image and produces a trimmed plain
 * text caption from the Markdown source.
 *
 * `buildXiaohongshuCaption` is pure and fully unit-tested; `exportXiaohongshu`
 * wires it to the poster export and the clipboard.
 */

import type { PreviewDevice } from './png-capture'
import type { PosterExportMode } from './png-poster'

/** Xiaohongshu title limit (characters, not bytes). */
export const XIAOHONGSHU_TITLE_MAX = 20

/** Default number of body characters appended after the title. */
export const XIAOHONGSHU_DEFAULT_BODY_EXCERPT = 300

/** Ellipsis appended when a segment is truncated. */
const ELLIPSIS = `…`

/** Truncate by Unicode code point so emoji / CJK never get split mid-character. */
function truncate(text: string, maxLength: number): string {
  const chars = Array.from(text)
  if (chars.length <= maxLength)
    return text
  return `${chars.slice(0, maxLength).join(``).trimEnd()}${ELLIPSIS}`
}

/** Collapse whitespace runs so the caption reads as a single tidy block. */
function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, `\n`)
    .replace(/[ \t]+/g, ` `)
    .replace(/ *\n */g, `\n`)
    .replace(/\n{3,}/g, `\n\n`)
    .trim()
}

/**
 * Flatten Markdown into plain text for the caption.
 *
 * Intentionally lightweight and dependency-free: fenced/inline code, images,
 * links, headings, blockquote markers, list bullets, emphasis and raw HTML are
 * all reduced to their visible text.
 */
export function stripMarkdownToPlain(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ` `)
    .replace(/~~~[\s\S]*?~~~/g, ` `)
    .replace(/`([^`]*)`/g, `$1`)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ` `)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, `$1`)
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, ``)
    .replace(/^[ \t]{0,3}>[ \t]?/gm, ``)
    .replace(/^[ \t]{0,3}(?:[-*+]|\d+\.)[ \t]+/gm, ``)
    .replace(/^[ \t]{0,3}[-*_](?:[ \t]*[-*_]){2,}[ \t]*$/gm, ` `)
    .replace(/(\*\*|__)(.*?)\1/g, `$2`)
    .replace(/(\*|_)(.*?)\1/g, `$2`)
    .replace(/~~(.*?)~~/g, `$1`)
    .replace(/<[^>]+>/g, ` `)

  return collapseWhitespace(plain)
}

/** Pick the title from an explicit value, else the first heading / line. */
function extractTitle(markdown: string): string {
  for (const raw of markdown.split(`\n`)) {
    const line = raw.trim()
    if (!line)
      continue
    // Drop a leading heading marker (only when followed by a space, so `#tag` is safe).
    return stripMarkdownToPlain(line.replace(/^#{1,6}[ \t]+/, ``))
  }
  return ``
}

/**
 * Build a Xiaohongshu caption: a short title followed by a body excerpt.
 *
 * @param markdown Full Markdown source.
 * @param title Optional title override (e.g. the post title).
 * @param maxBodyLength Max body characters to keep (default {@link XIAOHONGSHU_DEFAULT_BODY_EXCERPT}).
 * @returns `"title\n\nbody"`; empty string when there is nothing to show.
 */
export function buildXiaohongshuCaption(
  markdown: string,
  title?: string,
  maxBodyLength: number = XIAOHONGSHU_DEFAULT_BODY_EXCERPT,
): string {
  const source = markdown ?? ``
  const rawTitle = (title ?? ``).trim() || extractTitle(source)
  const safeTitle = truncate(collapseWhitespace(rawTitle), XIAOHONGSHU_TITLE_MAX)

  const plain = stripMarkdownToPlain(source)
  const withoutTitle = safeTitle && plain.startsWith(safeTitle)
    ? plain.slice(safeTitle.length).trim()
    : plain
  const body = truncate(withoutTitle, Math.max(0, maxBodyLength))

  return [safeTitle, body].filter(Boolean).join(`\n\n`)
}

export interface XiaohongshuExportOptions {
  previewDevice: PreviewDevice
  /** Post title; also used as the cover heading. */
  title?: string
  /** Full Markdown source used to build the caption. */
  markdown?: string
  /** Override the cover heading text. */
  coverTitle?: string
  /** Prepend a cover band. Defaults to true. */
  showCover?: boolean
  onProgress?: (done: number, total: number) => void
}

export interface XiaohongshuExportResult {
  /** Images written (1 for a poster, N for the segmented fallback). */
  images: number
  /** Which pipeline produced the images. */
  mode: PosterExportMode
  /** True when the poster had to be rendered below 1×. */
  downscaled: boolean
  /** Caption text that was built from the Markdown. */
  caption: string
  /** True when the caption was successfully copied to the clipboard. */
  copied: boolean
}

/**
 * Export the current article as a Xiaohongshu post: a vertical long image plus
 * a trimmed caption copied to the clipboard.
 *
 * Reuses {@link exportPNGPoster} so the cover band, device pixel ratio and
 * segmented fallback all behave exactly like the existing poster export.
 */
export async function exportXiaohongshu(
  options: XiaohongshuExportOptions,
): Promise<XiaohongshuExportResult> {
  const [{ exportPNGPoster }, { copyPlain }] = await Promise.all([
    import(`./png-poster`),
    import(`@/lib/browser/clipboard`),
  ])

  const title = options.title ?? ``
  const caption = buildXiaohongshuCaption(options.markdown ?? ``, options.title)

  const poster = await exportPNGPoster(title || `untitled`, {
    previewDevice: options.previewDevice,
    showCover: options.showCover ?? true,
    coverTitle: options.coverTitle ?? options.title,
    onProgress: options.onProgress,
  })

  let copied = false
  if (poster.count > 0 && caption) {
    try {
      await copyPlain(caption)
      copied = true
    }
    catch {
      copied = false
    }
  }

  return {
    images: poster.count,
    mode: poster.mode,
    downscaled: poster.downscaled,
    caption,
    copied,
  }
}

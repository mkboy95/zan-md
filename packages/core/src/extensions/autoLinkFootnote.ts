import type { MarkedExtension } from 'marked'

/**
 * Auto link → footnote.
 *
 * When applied to the full rendered document, every inline external http(s) link
 * keeps its visible text but gains a small superscript marker; all URLs are
 * collected (deduplicated) and a "参考文献 / References" list is appended at the
 * end of the document.
 *
 * Internal anchors (`#xxx`) and WeChat article links (`mp.weixin.qq.com`) are
 * left untouched.
 *
 * Everything emitted is WeChat-safe: plain `<sup>`/`<section>`/`<ol>` with scoped
 * classes (no `color-mix()`, no `::before`/`::after` content).
 *
 * Implemented as a post-render transform (see `applyAutoLinkFootnote`) applied
 * once on the whole document, rather than a marked hook, so it never runs on the
 * per-inline sub-parses that marked performs while rendering paragraphs.
 */

/** External link: captures the href and inner text of an inline <a> with an http(s) href. */
export const EXTERNAL_LINK_REGEX
  = /<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi

export const WEIXIN_LINK_REGEX = /^https?:\/\/mp\.weixin\.qq\.com/i

const REFERENCES_TITLE = `参考文献 / References`

/**
 * Transform a full HTML document: mark external links and append a references
 * list. Safe to call on the complete render output only (not on inline fragments).
 */
export function applyAutoLinkFootnote(html: string): string {
  const references: string[] = []
  const seen = new Map<string, number>()

  const processed = html.replace(
    EXTERNAL_LINK_REGEX,
    (full, href: string, inner: string) => {
      if (WEIXIN_LINK_REGEX.test(href))
        return full

      // Already marked (e.g. alongside another transform) — don't double up.
      if (inner.includes(`md-link-ref`))
        return full

      let ref = seen.get(href)
      if (ref === undefined) {
        ref = references.length + 1
        seen.set(href, ref)
        references.push(href)
      }

      return `<a href="${href}">${inner}<sup class="md-link-ref">[${ref}]</sup></a>`
    },
  )

  if (references.length === 0)
    return processed

  const items = references
    .map((url, index) => `<li><sup>[${index + 1}]</sup> <a href="${url}" rel="noopener noreferrer">${url}</a></li>`)
    .join(``)

  const referencesBlock = `
    <section class="md-references">
      <h4 class="md-references-title">${REFERENCES_TITLE}</h4>
      <ol class="md-references-list">${items}</ol>
    </section>
  `

  return processed + referencesBlock
}

/** Marked-extension wrapper kept for API symmetry; the transform is applied via `applyAutoLinkFootnote`. */
export function markedAutoLinkFootnote(): MarkedExtension {
  return {}
}

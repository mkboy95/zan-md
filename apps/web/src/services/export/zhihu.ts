/**
 * 知乎 (Zhihu) export adapter.
 *
 * The WeChat copy pipeline inlines a whole theme stylesheet (via juice) and
 * wraps the article in WeChat specific `section` / `span` decoration. Zhihu's
 * editor instead re-typesets on paste, so what it wants is *clean semantic
 * HTML*: the same document tree with the WeChat containers, `md-*` classes and
 * non-semantic inline styles stripped away.
 *
 * `toZhihuHtml` is a pure string transform (no stores, no async) so it can be
 * unit-tested without a browser or app bootstrap. `copyZhihuHtml` is the thin
 * imperative wrapper that reads the live preview and writes the result to the
 * clipboard. Heavy dependencies are imported lazily so importing this module
 * (e.g. from a test) never pulls in the render pipeline.
 */

/** Tags kept verbatim in the Zhihu output. */
const ZHIHU_ALLOWED_TAGS = new Set([
  `H1`,
  `H2`,
  `H3`,
  `H4`,
  `H5`,
  `H6`,
  `P`,
  `UL`,
  `OL`,
  `LI`,
  `BLOCKQUOTE`,
  `PRE`,
  `CODE`,
  `TABLE`,
  `THEAD`,
  `TBODY`,
  `TFOOT`,
  `TR`,
  `TH`,
  `TD`,
  `IMG`,
  `A`,
  `STRONG`,
  `EM`,
  `B`,
  `I`,
  `U`,
  `BR`,
  `HR`,
  `DEL`,
  `S`,
  `STRIKE`,
  `SUP`,
  `SUB`,
  `FIGURE`,
  `FIGCAPTION`,
])

/** Subtrees dropped entirely — never survive a Zhihu paste. */
const ZHIHU_DROP_TAGS = new Set([
  `STYLE`,
  `SCRIPT`,
  `NOSCRIPT`,
  `LINK`,
  `META`,
  `TEMPLATE`,
  `IFRAME`,
  `OBJECT`,
  `EMBED`,
  `CANVAS`,
  `VIDEO`,
  `AUDIO`,
  `FORM`,
  `INPUT`,
  `BUTTON`,
  `SELECT`,
  `TEXTAREA`,
  `SVG`,
  `MAP`,
  `AREA`,
])

/** Void tags — the emptiness pass never removes them. */
const ZHIHU_VOID_TAGS = new Set([
  `IMG`,
  `BR`,
  `HR`,
  `TD`,
  `TH`,
  `COL`,
  `COLGROUP`,
  `SOURCE`,
  `TRACK`,
  `WBR`,
])

/** Tags removed when they carry no visible content (spacers, empty deco). */
const ZHIHU_REMOVABLE_WHEN_EMPTY = new Set([
  `P`,
  `H1`,
  `H2`,
  `H3`,
  `H4`,
  `H5`,
  `H6`,
  `BLOCKQUOTE`,
  `FIGCAPTION`,
  `LI`,
  `A`,
  `STRONG`,
  `EM`,
  `B`,
  `I`,
  `U`,
  `DEL`,
  `S`,
  `STRIKE`,
  `SUP`,
  `SUB`,
])

/**
 * Inline properties kept because they carry meaning rather than WeChat theme
 * decoration. Everything else (margins, padding, font-size, line-height,
 * background images, CSS variables, …) is dropped — Zhihu re-applies its own.
 */
const ZHIHU_STYLE_WHITELIST = new Set([
  `color`,
  `background-color`,
  `font-weight`,
  `font-style`,
  `text-align`,
  `text-decoration`,
  `border`,
  `border-top`,
  `border-right`,
  `border-bottom`,
  `border-left`,
  `border-color`,
  `border-style`,
  `border-width`,
  `border-collapse`,
  `list-style-type`,
])

/** Attributes kept per tag; anything else (class / id / data-* / on*) is removed. */
const ZHIHU_ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  A: new Set([`href`, `title`]),
  IMG: new Set([`src`, `alt`, `title`, `data-src`]),
  OL: new Set([`start`]),
  TD: new Set([`colspan`, `rowspan`]),
  TH: new Set([`colspan`, `rowspan`]),
}

const COMMENT_NODE = 8
const ELEMENT_NODE = 1

/** Keep only whitelisted declarations, normalising `PROP: value` spacing. */
function filterStyle(style: string): string {
  const parts: string[] = []
  for (const declaration of style.split(`;`)) {
    const trimmed = declaration.trim()
    if (!trimmed)
      continue
    const colon = trimmed.indexOf(`:`)
    if (colon === -1)
      continue
    const property = trimmed.slice(0, colon).trim().toLowerCase()
    const value = trimmed.slice(colon + 1).trim()
    if (!value || !ZHIHU_STYLE_WHITELIST.has(property))
      continue
    parts.push(`${property}: ${value}`)
  }
  return parts.join(`; `)
}

/** Strip `class` / `id` / stray attributes; keep semantic attributes and filtered style. */
function cleanAttributes(el: Element) {
  const allowed = ZHIHU_ALLOWED_ATTRS[el.tagName.toUpperCase()]
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name === `style`) {
      const filtered = filterStyle(attr.value)
      if (filtered)
        el.setAttribute(`style`, filtered)
      else
        el.removeAttribute(`style`)
      continue
    }
    if (allowed?.has(name))
      continue
    el.removeAttribute(attr.name)
  }
}

/** Replace an element with its child nodes, preserving document order. */
function unwrapElement(el: Element) {
  const parent = el.parentNode
  if (!parent)
    return
  while (el.firstChild)
    parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

/**
 * Recursively normalise the tree in place: drop forbidden subtrees, flatten
 * WeChat wrappers (`section` / `div` / decorative `span`), then clean the
 * attributes of whatever survives.
 */
function cleanNode(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === COMMENT_NODE) {
      node.removeChild(child)
      continue
    }
    if (child.nodeType !== ELEMENT_NODE)
      continue

    const el = child as Element
    const tag = el.tagName.toUpperCase()

    if (ZHIHU_DROP_TAGS.has(tag)) {
      el.remove()
      continue
    }

    if (!ZHIHU_ALLOWED_TAGS.has(tag)) {
      cleanNode(el)
      unwrapElement(el)
      continue
    }

    cleanNode(el)
    cleanAttributes(el)
  }
}

/** An element is meaningful if it holds text, an image, a rule, or a break. */
function hasVisibleContent(el: Element): boolean {
  if (el.querySelector(`img, hr, br, table, pre`))
    return true
  return (el.textContent ?? ``).replace(/\u00A0/g, ` `).trim().length > 0
}

/** Drop spacer/empty wrappers WeChat adds around the article. */
function removeEmptyElements(container: HTMLElement) {
  for (const el of Array.from(container.querySelectorAll(`*`))) {
    const tag = el.tagName.toUpperCase()
    if (ZHIHU_VOID_TAGS.has(tag) || !ZHIHU_REMOVABLE_WHEN_EMPTY.has(tag))
      continue
    if (hasVisibleContent(el))
      continue
    el.remove()
  }
}

/**
 * Convert rendered preview HTML into clean semantic HTML for Zhihu.
 *
 * @param html Rendered article HTML (typically `#output`'s innerHTML).
 * @returns Semantic HTML with WeChat containers / decoration removed.
 */
export function toZhihuHtml(html: string): string {
  if (!html || !html.trim())
    return ``
  const container = document.createElement(`div`)
  container.innerHTML = html
  cleanNode(container)
  removeEmptyElements(container)
  return container.innerHTML
}

/** Last-resort text view when Markdown conversion yields nothing. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ``)
    .replace(/&nbsp;/gi, ` `)
    .replace(/&amp;/gi, `&`)
    .replace(/&lt;/gi, `<`)
    .replace(/&gt;/gi, `>`)
    .replace(/\s+/g, ` `)
    .trim()
}

export interface ZhihuCopyResult {
  /** Semantic HTML written as `text/html`. */
  html: string
  /** Markdown / plain-text fallback written as `text/plain`. */
  plainText: string
  /** True when async diagrams or formulas were still rendering. */
  hasPendingAsyncContent: boolean
}

/**
 * Copy the current article as Zhihu-ready HTML.
 *
 * Reads the live preview, converts it with {@link toZhihuHtml}, and writes
 * `text/html` plus a Markdown `text/plain` fallback to the clipboard.
 *
 * @throws When there is no rendered content to copy.
 */
export async function copyZhihuHtml(): Promise<ZhihuCopyResult> {
  const [{ getHtmlContent }, { waitForPreviewReady }, { copyHtml }, { htmlToMarkdown }] = await Promise.all([
    import(`./html-content`),
    import(`@/lib/preview/preview-ready`),
    import(`@/lib/browser/clipboard`),
    import(`@/lib/html-to-markdown`),
  ])

  const previewReady = await waitForPreviewReady()
  const html = toZhihuHtml(getHtmlContent())
  if (!html)
    throw new Error(`No rendered content to copy.`)

  const markdown = htmlToMarkdown(html)
  const plainText = markdown || stripTags(html)

  await copyHtml(html, plainText)

  return { html, plainText, hasPendingAsyncContent: !previewReady }
}

/**
 * Download the Zhihu-ready HTML as a standalone `.html` file.
 *
 * A lightweight alternative for users who prefer to import the document rather
 * than paste it. Shares the same {@link toZhihuHtml} transform.
 */
export async function downloadZhihuHtmlFile(title: string = `untitled`): Promise<void> {
  const [{ getHtmlContent }, { sanitizeTitle }, { downloadFile }] = await Promise.all([
    import(`./html-content`),
    import(`@md/shared/utils/basicHelpers`),
    import(`@md/shared/utils/fileHelpers`),
  ])

  const body = toZhihuHtml(getHtmlContent())
  const safeTitle = sanitizeTitle(title)
  const htmlDocument = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
</head>
<body>
${body}
</body>
</html>`

  downloadFile(htmlDocument, `${safeTitle}.html`, `text/html`)
}

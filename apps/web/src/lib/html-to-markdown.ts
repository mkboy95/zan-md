/**
 * Self-contained HTML → Markdown converter.
 *
 * The editor's paste pipeline uses this when the clipboard carries `text/html`
 * (Notion / Word / 飞书 …): the fragment is parsed with the browser `DOMParser`
 * and flattened into GitHub-flavored Markdown. It is deliberately
 * dependency-free — no `turndown` and friends — so it ships inside the bundle
 * without touching the lockfile.
 *
 * The conversion is lossy by design: layout noise from exported documents
 * (`<o:p>`, `mso-*` styles, `<!--StartFragment-->`, empty spacer spans) is
 * stripped so the writer gets clean Markdown instead of a wall of `<span>`s.
 */

/** Inline/block markers kept in variables so they survive string replacement. */
const CODE_FENCE = '```'
const TILDE_FENCE = '~~~'
const BACKTICK = '`'

/** Elements whose whole subtree is discarded. */
const SKIP_TAGS = new Set([
  `STYLE`,
  `SCRIPT`,
  `NOSCRIPT`,
  `HEAD`,
  `META`,
  `LINK`,
  `TITLE`,
  `BASE`,
  `COL`,
  `COLGROUP`,
  `TEMPLATE`,
  `IFRAME`,
  `OBJECT`,
  `EMBED`,
  `CANVAS`,
  `SVG`,
  `VIDEO`,
  `AUDIO`,
  `INPUT`,
  `BUTTON`,
  `SELECT`,
  `TEXTAREA`,
  `FORM`,
  `MAP`,
  `AREA`,
])

/** Block wrappers that carry no Markdown of their own — just recurse. */
const TRANSPARENT_BLOCK_TAGS = new Set([
  `DIV`,
  `SECTION`,
  `ARTICLE`,
  `HEADER`,
  `FOOTER`,
  `MAIN`,
  `ASIDE`,
  `NAV`,
  `FIGURE`,
  `FIGCAPTION`,
  `ADDRESS`,
  `DETAILS`,
  `SUMMARY`,
  `CENTER`,
  `HGROUP`,
  `DL`,
  `DT`,
  `DD`,
  `CAPTION`,
  `BODY`,
])

const HEADING_TAGS = new Set([`H1`, `H2`, `H3`, `H4`, `H5`, `H6`])

/** Indentation unit for one nested list level. */
const LIST_INDENT = `    `

interface ConvertContext {
  /** Inside a `<pre>`: text nodes keep their original whitespace. */
  inPre: boolean
  /** Current list nesting depth (0 = top level). */
  listDepth: number
  /** Ordered counters for Word `MsoListParagraph` runs, keyed by `listId:level`. */
  wordListCounters: Map<string, number>
}

function createContext(): ConvertContext {
  return { inPre: false, listDepth: 0, wordListCounters: new Map() }
}

/** Replace non-breaking spaces and collapse runs of spaces/tabs. */
function normalizeInline(text: string): string {
  return text
    .replace(/\u00A0/g, ` `)
    .replace(/[ \t]{2,}/g, ` `)
    .replace(/[ \t]*\n[ \t]*/g, `\n`)
    .replace(/\n{3,}/g, `\n\n`)
    .trim()
}

/** Trim leading/trailing blank lines and collapse 3+ newlines into one blank line. */
function normalizeBlock(text: string): string {
  return text
    .replace(/\n{3,}/g, `\n\n`)
    .replace(/^\n+/, ``)
    .replace(/\n+$/, ``)
}

/** Final pass: normalize line endings, drop whitespace-only lines, tidy blank lines. */
function cleanupMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, `\n`)
    .split(`\n`)
    .map(line => (line.trim() === `` ? `` : line.replace(/[ \t]+$/, ``)))
    .join(`\n`)
    .replace(/\n{3,}/g, `\n\n`)
    .replace(/^\n+/, ``)
    .replace(/\n+$/, ``)
}

/** Wrap inline content in a symmetric marker, preserving surrounding spaces. */
function wrapInline(content: string, marker: string): string {
  const inner = content.trim()
  if (!inner)
    return content
  const leading = content.match(/^\s*/)?.[0] ?? ``
  const trailing = content.match(/\s*$/)?.[0] ?? ``
  return `${leading}${marker}${inner}${marker}${trailing}`
}

function renderText(node: Text, ctx: ConvertContext): string {
  const raw = node.data.replace(/\u00A0/g, ` `)
  return ctx.inPre ? raw : raw.replace(/\s+/g, ` `)
}

function renderChildren(parent: Node, ctx: ConvertContext): string {
  let output = ``
  for (const child of Array.from(parent.childNodes))
    output += renderNode(child, ctx)
  return output
}

function renderNode(node: Node, ctx: ConvertContext): string {
  switch (node.nodeType) {
    // ELEMENT_NODE
    case 1:
      return renderElement(node as Element, ctx)
    // TEXT_NODE
    case 3:
      return renderText(node as Text, ctx)
    default:
      // Comments (`<!--StartFragment-->`) and everything else are dropped.
      return ``
  }
}

function renderInlineCode(el: Element): string {
  const code = (el.textContent ?? ``)
    .replace(/\u00A0/g, ` `)
    .replace(/\n+/g, ` `)
    .trim()
  if (!code)
    return ``
  // A leading/trailing backtick would break the inline span; pad it with spaces.
  const pad = code.startsWith(BACKTICK) || code.endsWith(BACKTICK) ? ` ` : ``
  return `${BACKTICK}${pad}${code}${pad}${BACKTICK}`
}

function renderLink(el: Element, ctx: ConvertContext): string {
  const href = (el.getAttribute(`href`) ?? ``).trim()
  const text = normalizeInline(renderChildren(el, ctx))
  if (!href || href.toLowerCase().startsWith(`javascript:`))
    return text
  if (!text)
    return href
  return `[${text}](${href})`
}

function renderImage(el: Element): string {
  const src = (el.getAttribute(`src`) || el.getAttribute(`data-src`) || ``).trim()
  if (!src)
    return ``
  const alt = (el.getAttribute(`alt`) ?? ``).trim()
  const title = (el.getAttribute(`title`) ?? ``).trim()
  return `![${alt}](${src}${title ? ` "${title}"` : ``})`
}

function detectCodeLanguage(el: Element | null): string {
  if (!el)
    return ``
  const fromData = el.getAttribute(`data-lang`) ?? el.getAttribute(`data-language`)
  if (fromData)
    return fromData.trim()
  const className = el.getAttribute(`class`) ?? ``
  const match = className.match(/(?:language|lang|highlight-source)-([\w+#.-]+)/i)
  return match?.[1] ?? ``
}

function renderCodeBlock(pre: Element): string {
  const codeEl = pre.querySelector(`code`)
  const source = codeEl ?? pre
  const language = detectCodeLanguage(codeEl) || detectCodeLanguage(pre)
  const code = (source.textContent ?? ``).replace(/\r\n?/g, `\n`).replace(/\n+$/, ``)
  const fence = code.includes(CODE_FENCE) ? TILDE_FENCE : CODE_FENCE
  return `\n\n${fence}${language}\n${code}\n${fence}\n\n`
}

function renderBlockquote(el: Element, ctx: ConvertContext): string {
  const inner = normalizeBlock(renderChildren(el, ctx))
  if (!inner)
    return ``
  const quoted = inner
    .split(`\n`)
    .map(line => (line ? `> ${line}` : `> `))
    .join(`\n`)
  return `\n\n${quoted}\n\n`
}

function renderList(list: Element, ctx: ConvertContext): string {
  const ordered = list.tagName.toUpperCase() === `OL`
  const parsedStart = Number.parseInt(list.getAttribute(`start`) ?? `1`, 10)
  const start = Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : 1
  const indent = LIST_INDENT.repeat(ctx.listDepth)
  const lines: string[] = []
  let index = 0

  for (const child of Array.from(list.children)) {
    if (child.tagName.toUpperCase() !== `LI`)
      continue
    const marker = ordered ? `${start + index}. ` : `- `
    index++
    lines.push(`${indent}${renderListItem(child, ctx, marker)}`)
  }

  return lines.join(`\n`)
}

function renderListItem(li: Element, ctx: ConvertContext, marker: string): string {
  const inlineParts: string[] = []
  const nestedLists: Element[] = []

  for (const child of Array.from(li.childNodes)) {
    if (child.nodeType === 1) {
      const tag = (child as Element).tagName.toUpperCase()
      if (tag === `UL` || tag === `OL`) {
        nestedLists.push(child as Element)
        continue
      }
    }
    inlineParts.push(renderNode(child, ctx))
  }

  // List items are single-line; embedded newlines become spaces.
  const text = normalizeInline(inlineParts.join(``)).replace(/\n+/g, ` `)
  const head = `${marker}${text}`.trimEnd()
  const nested = nestedLists
    .map(list => renderList(list, { ...ctx, listDepth: ctx.listDepth + 1 }))
    .join(`\n`)

  return nested ? `${head}\n${nested}` : head
}

function isWordListParagraph(el: Element): boolean {
  const className = el.getAttribute(`class`) ?? ``
  const style = el.getAttribute(`style`) ?? ``
  return /mso-list/i.test(style) || /MsoListParagraph/i.test(className)
}

interface WordListMeta {
  level: number
  listId: string
  ordered: boolean
}

function parseWordListMeta(el: Element): WordListMeta {
  const style = el.getAttribute(`style`) ?? ``
  const value = style.match(/mso-list\s*:\s*([^;]+)/i)?.[1] ?? ``
  let level = 1
  let listId = `l0`

  for (const token of value.split(/\s+/).filter(Boolean)) {
    const levelMatch = token.match(/^level(\d+)$/i)
    if (levelMatch)
      level = Number.parseInt(levelMatch[1], 10)
    else if (/^l\d+$/i.test(token))
      listId = token.toLowerCase()
  }

  const markerSpan = Array.from(el.querySelectorAll(`span`))
    .find(span => /mso-list\s*:\s*ignore/i.test(span.getAttribute(`style`) ?? ``))
  const markerText = (markerSpan?.textContent ?? ``).trim()
  // "1." / "a)" are ordered markers; "·" / "o" / "▪" are bullets.
  const ordered = /^(?:\d+|[a-z])[.)]/i.test(markerText)

  return { level: Number.isFinite(level) ? level : 1, listId, ordered }
}

function renderWordListItem(el: Element, ctx: ConvertContext): string {
  const { level, listId, ordered } = parseWordListMeta(el)
  const clone = el.cloneNode(true) as Element
  Array.from(clone.querySelectorAll(`span`)).forEach((span) => {
    if (/mso-list\s*:\s*ignore/i.test(span.getAttribute(`style`) ?? ``))
      span.remove()
  })

  const text = normalizeInline(renderChildren(clone, ctx)).replace(/\n+/g, ` `)
  const indent = LIST_INDENT.repeat(Math.max(0, level - 1))
  if (!text)
    return ``

  if (!ordered)
    return `\n\n${indent}- ${text}\n\n`

  const key = `${listId}:${level}`
  const next = (ctx.wordListCounters.get(key) ?? 0) + 1
  ctx.wordListCounters.set(key, next)
  return `\n\n${indent}${next}. ${text}\n\n`
}

function renderParagraph(el: Element, ctx: ConvertContext): string {
  if (isWordListParagraph(el))
    return renderWordListItem(el, ctx)
  const content = normalizeInline(renderChildren(el, ctx))
  return content ? `\n\n${content}\n\n` : ``
}

function renderCell(cell: Element, ctx: ConvertContext): string {
  return normalizeInline(renderChildren(cell, { ...ctx, inPre: false }))
    .replace(/\|/g, `\\|`)
    .replace(/\n+/g, ` `)
    .trim()
}

function renderTable(table: Element, ctx: ConvertContext): string {
  const rows = Array.from(table.querySelectorAll(`tr`))
  if (rows.length === 0)
    return ``

  const matrix = rows.map(row =>
    Array.from(row.querySelectorAll(`:scope > th, :scope > td`)).map(cell => renderCell(cell, ctx)),
  )
  const columnCount = Math.max(...matrix.map(row => row.length))
  if (columnCount === 0)
    return ``

  const padded = matrix.map(row => [
    ...row,
    ...Array.from<string>({ length: columnCount - row.length }).fill(``),
  ])
  const [header, ...body] = padded
  const lines = [
    `| ${header.join(` | `)} |`,
    `| ${Array.from<string>({ length: columnCount }).fill(`---`).join(` | `)} |`,
    ...body.map(row => `| ${row.join(` | `)} |`),
  ]
  return lines.join(`\n`)
}

function renderElement(el: Element, ctx: ConvertContext): string {
  const tag = el.tagName.toUpperCase()
  if (SKIP_TAGS.has(tag))
    return ``
  // Namespaced noise (`<o:p>`, `<w:r>`, `<v:imagedata>` …) never carries Markdown.
  if (tag.includes(`:`))
    return ``

  if (HEADING_TAGS.has(tag)) {
    const level = Number(tag[1])
    const content = normalizeInline(renderChildren(el, ctx))
    return content ? `\n\n${`#`.repeat(level)} ${content}\n\n` : ``
  }

  switch (tag) {
    case `P`:
      return renderParagraph(el, ctx)
    case `BR`:
      // A hard break inside a paragraph becomes a soft newline; block-level
      // cleanup keeps a single blank line between blocks.
      return `\n`
    case `HR`:
      return `\n\n---\n\n`
    case `STRONG`:
    case `B`:
      return wrapInline(renderChildren(el, ctx), `**`)
    case `EM`:
    case `I`:
      return wrapInline(renderChildren(el, ctx), `*`)
    case `DEL`:
    case `S`:
    case `STRIKE`:
      return wrapInline(renderChildren(el, ctx), `~~`)
    case `CODE`:
      return ctx.inPre ? renderChildren(el, ctx) : renderInlineCode(el)
    case `SPAN`: {
      // Word/Notion often express bold/italic through inline styles rather
      // than semantic tags — recover the emphasis so it is not lost.
      const content = renderChildren(el, ctx)
      const style = (el.getAttribute(`style`) ?? ``).toLowerCase()
      const bold = /font-weight\s*:\s*(?:bold|[6-9]00)/.test(style)
        || /mso-bidi-font-weight\s*:\s*bold/.test(style)
      const italic = /font-style\s*:\s*italic/.test(style)
        || /mso-bidi-font-style\s*:\s*italic/.test(style)
      let output = content
      if (italic)
        output = wrapInline(output, `*`)
      if (bold)
        output = wrapInline(output, `**`)
      return output
    }
    case `A`:
      return renderLink(el, ctx)
    case `IMG`:
      return renderImage(el)
    case `PRE`:
      return renderCodeBlock(el)
    case `BLOCKQUOTE`:
      return renderBlockquote(el, ctx)
    case `UL`:
    case `OL`:
      return `\n\n${renderList(el, ctx)}\n\n`
    case `LI`:
      return `\n${renderListItem(el, ctx, `- `)}\n`
    case `TABLE`:
      return `\n\n${renderTable(el, ctx)}\n\n`
    default:
      if (TRANSPARENT_BLOCK_TAGS.has(tag))
        return `\n\n${renderChildren(el, ctx)}\n\n`
      return renderChildren(el, ctx)
  }
}

/** Convert a parsed HTML document (or fragment root) into Markdown. */
export function documentToMarkdown(doc: Document): string {
  const root = doc.body ?? doc.documentElement
  if (!root)
    return ``
  return cleanupMarkdown(renderChildren(root, createContext()))
}

/** Convert a live DOM element (e.g. a paste target) into Markdown. */
export function elementToMarkdown(el: Element): string {
  return cleanupMarkdown(renderChildren(el, createContext()))
}

/** Last-resort fallback: drop tags, collapse whitespace. Never throws. */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ``)
    .replace(/<[^>]*>/g, ``)
    .replace(/&nbsp;/gi, ` `)
    .replace(/&amp;/gi, `&`)
    .replace(/&lt;/gi, `<`)
    .replace(/&gt;/gi, `>`)
    .replace(/&quot;/gi, `"`)
    .replace(/&#39;/g, `'`)
    .replace(/\s+/g, ` `)
    .trim()
}

/**
 * Convert an HTML string into Markdown.
 *
 * Returns an empty string when there is nothing to convert or when parsing
 * fails; callers should fall back to the clipboard's `text/plain` in that case.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim())
    return ``
  if (typeof DOMParser === `undefined`)
    return stripHtmlToText(html)

  try {
    const doc = new DOMParser().parseFromString(html, `text/html`)
    return documentToMarkdown(doc)
  }
  catch {
    return stripHtmlToText(html)
  }
}

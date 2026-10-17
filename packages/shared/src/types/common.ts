import type { Token } from 'marked'
import type { ComponentRegistry } from './component'

/**
 * Renderer options (CSS-injected theme system).
 * isUseIndent / isUseJustify are handled via CSS variables, not passed to the renderer.
 */
export interface DiagramMessages {
  mermaidLoading: string
  /** Supports `{detail}` placeholder */
  mermaidError: string
  plantumlLoading: string
  plantumlError: string
  infographicLoading: string
  /** Supports `{detail}` placeholder */
  infographicError: string
}

export interface CountMessages {
  summary: string
}

/** Render-pipeline UI copy (injected by locale on Web) */
export interface RenderMessages {
  /** Footnote reference link title */
  footnoteTitle: string
  /** Unknown custom component message; supports `{name}` placeholder */
  unknownComponent: string
  /** Block math loading placeholder */
  katexLoading: string
}

export interface IOpts {
  legend?: string
  citeStatus?: boolean
  countStatus?: boolean
  isMacCodeBlock?: boolean
  isShowLineNumber?: boolean
  themeMode?: 'light' | 'dark'
  /**
   * Auto external-link → footnote. When on, inline http(s) links keep their
   * text but gain a marker, and a "参考文献 / References" list is appended.
   * @default false
   */
  autoLinkFootnote?: boolean
  /**
   * Image gallery. When on, 2+ consecutive standalone images are wrapped in a
   * responsive grid. @default true
   */
  imageGallery?: boolean
  /**
   * Heading structure emitted by the renderer.
   *
   * - `plain` (default): bare inline content, every theme can style it.
   * - `indexed`: h2 gains an auto number (`01` + `PART`) and a divider, h3
   *   gains a leading dot. Used by magazine-style themes whose layout depends
   *   on those parts; other themes must keep `plain` so their CSS still
   *   targets the bare heading.
   */
  headingStructure?: 'plain' | 'indexed'
  /** Custom component registry */
  components?: ComponentRegistry
  /** Async diagram load/error copy (injected by locale on Web) */
  diagramMessages?: DiagramMessages
  /** Reading-time summary copy (injected by locale on Web) */
  countMessages?: CountMessages
  /** Footnotes, unknown components, math loading, etc. (injected by locale on Web) */
  renderMessages?: RenderMessages
  /**
   * Resolve a sticker / emoji id to a URL. The Web app injects the cloud
   * asset lookup at render time so the markdown package stays storage-agnostic.
   */
  assetResolver?: (id: string) => string
}

export interface IConfigOption<VT = string> {
  label: string
  value: VT
  desc: string
}

/**
 * Options for the `markedAlert` extension.
 */
export interface AlertOptions {
  className?: string
  variants?: AlertVariantItem[]
  withoutStyle?: boolean
}

/**
 * Configuration for an alert type.
 */
export interface AlertVariantItem {
  type: string
  icon: string
  title?: string
  titleClassName?: string
}

/**
 * Represents an alert token.
 */
export interface Alert {
  type: `alert`
  meta: {
    className: string
    variant: string
    icon: string
    title: string
    titleClassName: string
  }
  raw: string
  text: string
  tokens: Token[]
}

export interface PostAccount {
  avatar?: string
  displayName: string
  home: string
  icon: string
  supportTypes?: string[]
  title: string
  type: string
  uid: string
  checked: boolean
  loggedIn?: boolean
  isChecking?: boolean
  status?: string
  error?: string
}

export interface Post {
  title: string
  desc: string
  thumb: string
  content: string
  markdown: string
  accounts: PostAccount[]
}

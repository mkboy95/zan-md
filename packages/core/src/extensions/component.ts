import type { ComponentRegistry, CustomComponentDef } from '@md/shared/types'
import type { MarkedExtension } from 'marked'
import { escapeHtml, unescapeHtml } from '../utils/basicHelpers'
import { blockScanLimit, indexOfWithin } from '../utils/scan'

// Built-in components

export const BUILT_IN_COMPONENTS: CustomComponentDef[] = [
  {
    id: `builtin-mp-profile`,
    name: `MpProfile`,
    description: `公众号名片组件，展示微信公众号名片`,
    builtIn: true,
    props: [
      { name: `mpId`, description: `公众号 ID`, required: true },
      { name: `nickname`, description: `公众号名称`, required: true },
      { name: `headimg`, description: `公众号头像 URL` },
      { name: `signature`, description: `公众号简介` },
      { name: `serviceType`, description: `账号类型（1=公众号，2=服务号）`, default: `1` },
      { name: `verifyStatus`, description: `认证状态（0=无，1=个人，2=企业）`, default: `0` },
    ],
    template: `<section class="mp_profile_iframe_wrp custom_select_card_wrp" nodeleaf="">
  <mp-common-profile class="mpprofile js_uneditable custom_select_card mp_profile_iframe" data-pluginname="mpprofile" data-id="{{mpId}}" data-nickname="{{nickname}}" data-headimg="{{headimg}}" data-signature="{{signature}}" data-service_type="{{serviceType}}" data-verify_status="{{verifyStatus}}"></mp-common-profile>
  <br class="ProseMirror-trailingBreak">
</section>`,
    example: `<MpProfile mpId="MzIxNjA5ODQ0OQ==" nickname="Doocs" headimg="https://cdn-doocs.oss-cn-shenzhen.aliyuncs.com/gh/doocs/md/images/mp-logo.png" signature="GitHub 开源组织" serviceType="1" verifyStatus="1" />`,
  },
  {
    id: `builtin-qrcode`,
    name: `QRCodeBlock`,
    description: `二维码组件，将 URL 渲染为可扫描的二维码图片`,
    builtIn: true,
    props: [
      { name: `url`, description: `二维码内容（URL）`, required: true },
      { name: `text`, description: `二维码下方提示文字`, default: `扫码访问` },
      { name: `size`, description: `二维码尺寸（px）`, default: `150` },
    ],
    template: `<section style="text-align: center; margin: 20px auto; padding: 16px 0;">
  <img
    src="https://api.qrserver.com/v1/create-qr-code/?size={{size}}x{{size}}&data={{url}}"
    alt="QR Code"
    style="width: {{size}}px; height: {{size}}px; display: block; margin: 0 auto; border-radius: 4px;"
  />
  <p style="text-align: center; font-size: 14px; color: {{_textTertiary_}}; margin-top: 8px; margin-bottom: 0;">{{text}}</p>
</section>`,
    example: `<QRCodeBlock url="https://md.doocs.org" text="扫码访问" size="150" />`,
  },
  {
    id: `builtin-author`,
    name: `AuthorBlock`,
    description: `作者信息组件，展示作者头像、名称和简介`,
    builtIn: true,
    props: [
      { name: `name`, description: `作者名称`, required: true },
      { name: `avatar`, description: `头像图片 URL` },
      { name: `bio`, description: `作者简介` },
    ],
    template: `<section style="display: table; width: 100%; padding: 16px 0; margin: 16px 0; box-sizing: border-box;">
  <section style="display: table-cell; vertical-align: middle; width: 64px;">
    <img src="{{avatar}}" alt="{{name}}" style="width: 56px; height: 56px; border-radius: 50%; display: block;" />
  </section>
  <section style="display: table-cell; vertical-align: middle; padding-left: 12px;">
    <p style="margin: 0 0 4px; font-size: 15px; font-weight: bold; color: {{_textPrimary_}};">{{name}}</p>
    <p style="margin: 0; font-size: 13px; color: {{_textTertiary_}}; line-height: 1.5;">{{bio}}</p>
  </section>
</section>`,
    example: `<AuthorBlock name="yanglbme" avatar="https://avatars.githubusercontent.com/u/21008209?v=4" bio="Creator of Doocs" />`,
  },
  {
    id: `builtin-tip`,
    name: `TipBlock`,
    description: `提示框组件，高亮展示小贴士或注意事项`,
    builtIn: true,
    props: [
      { name: `type`, description: `类型：info、success、warning、danger`, default: `info` },
      { name: `title`, description: `标题（可选）` },
      { name: `content`, description: `提示内容`, required: true },
    ],
    template: `<section style="border-left: 4px solid {{borderColor}}; background: {{bgColor}}; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
  {{#if title}}<p style="margin: 0 0 6px; font-size: 14px; font-weight: bold; color: {{textColor}};">{{title}}</p>{{/if}}
  <p style="margin: 0; font-size: 14px; color: {{textColor}}; line-height: 1.6;">{{content}}</p>
</section>`,
    example: `<TipBlock type="info" title="提示" content="这是一条提示信息" />`,
  },
  {
    id: `builtin-table`,
    name: `TableBlock`,
    description: `表格组件，用 JSON 数组渲染样式化表格，支持斑马纹`,
    builtIn: true,
    props: [
      { name: `headers`, description: `列标题 JSON 字符串数组`, required: true, type: `array` },
      { name: `rows`, description: `数据行 JSON 二维数组`, required: true, type: `array` },
      { name: `striped`, description: `斑马纹行（true/false）`, default: `true` },
      { name: `caption`, description: `表格标题（可选）` },
    ],
    template: ``,
    example: `<TableBlock headers='["名称","版本","状态"]' rows='[["Vue","3.x","稳定"],["Vite","8.x","稳定"],["pnpm","10.x","稳定"]]' caption="技术栈清单" />`,
  },
  {
    id: `builtin-info-grid`,
    name: `InfoGrid`,
    description: `信息网格组件，以多列展示键值对信息`,
    builtIn: true,
    props: [
      { name: `items`, description: `JSON 数组，每项含 label、value 字段`, required: true, type: `array` },
      { name: `cols`, description: `列数（1-3）`, default: `2` },
    ],
    template: ``,
    example: `<InfoGrid items='[{"label":"作者","value":"yanglbme"},{"label":"版本","value":"v1.0"},{"label":"许可证","value":"MIT"},{"label":"语言","value":"TypeScript"}]' cols="2" />`,
  },
  {
    id: `builtin-badge-group`,
    name: `BadgeGroup`,
    description: `标签组组件，展示一组彩色标签`,
    builtIn: true,
    props: [
      { name: `tags`, description: `JSON 字符串数组，标签列表`, required: true, type: `array` },
      { name: `color`, description: `标签主色调（hex）`, default: `#07c160` },
    ],
    template: `<section style="display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0;">
{{#each tags}}<span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 500; background: {{color}}1a; color: {{color}}; border: 1px solid {{color}}40;">{{item}}</span>{{/each}}
</section>`,
    example: `<BadgeGroup tags='["Vue 3","TypeScript","Vite","Tailwind CSS"]' color="#07c160" />`,
  },
  {
    id: `builtin-emoji`,
    name: `Emoji`,
    description: `行内表情贴纸，从系统或「我的表情」插入`,
    builtIn: true,
    inline: true,
    hidden: true,
    template: ``,
    props: [
      { name: `id`, description: `表情 ID`, required: true },
      { name: `alt`, description: `替代文本（可选）` },
      { name: `width`, description: `宽度百分比，如 20%（可选，默认小尺寸）` },
      { name: `align`, description: `独占一行时的对齐：left、center、right（可选）` },
    ],
    example: `<Emoji id="liulei" alt="流泪" />`,
  },
  {
    id: `builtin-chat`,
    name: `ChatBlock`,
    description: `对话块组件，将 [A]/[B] 角色消息渲染为左右聊天气泡`,
    builtIn: true,
    props: [
      { name: `title`, description: `对话标题（可选）` },
      { name: `me`, description: `己方角色代号，显示在右侧（如 A 或 B）`, default: `B` },
      { name: `nameA`, description: `角色 A 的显示名称（可选）` },
      { name: `nameB`, description: `角色 B 的显示名称（可选）` },
      { name: `avatarA`, description: `角色 A 头像图片 URL（可选）` },
      { name: `avatarB`, description: `角色 B 头像图片 URL（可选）` },
      {
        name: `messages`,
        description: `JSON 数组消息，可替代 [A]/[B] 正文写法`,
        default: `[["A","在吗？帮我看下这段代码"],["B","在的，发过来吧"],["A","好的，谢谢！"]]`,
      },
    ],
    template: ``,
    example: `<ChatBlock title="项目群" me="B" nameA="小红" nameB="我">
[A] 在吗？帮我看下这段代码
[B] 在的，发过来吧
[A] 好的，谢谢！
</ChatBlock>`,
  },
  {
    id: `builtin-cover`,
    name: `CoverBlock`,
    description: `杂志封面卡：眉标条 + 划线引题 + 双色大标题 + 副标 + 主色作者栏`,
    builtIn: true,
    props: [
      { name: `eyebrow`, description: `眉标文字，如 REVIEW · 工具评测` },
      { name: `date`, description: `眉标右侧日期，如 2026.08` },
      { name: `kicker`, description: `标题上方带删除线的引题（可选）` },
      { name: `title`, description: `大标题第一行` },
      { name: `accent`, description: `第一行末尾用主色高亮的字（可选）` },
      { name: `title2`, description: `大标题第二行（主色，可选）` },
      { name: `subtitle`, description: `标题下方灰色副标` },
      { name: `author`, description: `作者栏左侧文字` },
      { name: `chips`, description: `作者栏右侧胶囊，逗号分隔（可选）` },
    ],
    template: ``,
    example: `<CoverBlock eyebrow="REVIEW · 工具评测" date="2026.08" kicker="同步方案那么多，怎么选？" title="Obsidian 多端同步，" accent="实测" title2="4 种免费方案怎么选" subtitle="方案对比 · 上手实测 · 免费 · 全平台" author="跟着大洲学AI" chips="免费方案,零折腾" />`,
  },
  {
    id: `builtin-parts`,
    name: `PartCards`,
    description: `可横滑的分节目录卡：首张主色实心，其余白底描边`,
    builtIn: true,
    props: [
      { name: `label`, description: `目录行左侧文字`, default: `📦 4 Parts + Conclusion` },
      { name: `hint`, description: `目录行右侧提示`, default: `👉 滑动` },
      { name: `items`, description: `卡片列表，分号分隔，每项形如 编号|标题|英文副标`, required: true },
    ],
    template: ``,
    example: `<PartCards items="01|为什么同步这么难|WHY SYNC;02|免费方案怎么选|FREE OPTIONS;03|Mac 端 5 分钟装好|SETUP;04|踩坑实录|PITFALLS" />`,
  },
]

/** Names reserved for system inline components; not parsed as block tags. */
export const INLINE_SYSTEM_COMPONENT_NAMES = new Set([`Emoji`])

export function isInlineSystemComponent(name: string): boolean {
  return INLINE_SYSTEM_COMPONENT_NAMES.has(name)
}

// Prop parsing

/** Parse prop string into key→value map */
function parseProps(propsStr: string): Record<string, string> {
  const result: Record<string, string> = {}
  // key="value" and key='value'
  for (const m of propsStr.matchAll(/(\w[\w-]*)=(?:"([^"]*)"|'([^']*)')/g)) {
    result[m[1]] = unescapeHtml(m[2] !== undefined ? m[2] : (m[3] ?? ``))
  }
  return result
}

// CSS variables & palette (light fallbacks; dark overridden via injected vars)

/** Palette shorthand → light fallback, injected as template vars (_ prefix avoids prop clash) */
function injectPaletteVars(props: Record<string, string>): Record<string, string> {
  return {
    _bgPrimary_: `var(--md-comp-bg, #fff)`,
    _bgSecondary_: `var(--md-comp-bg-secondary, #f5f5f5)`,
    _bgStripe_: `var(--md-comp-bg-stripe, #fafafa)`,
    _textPrimary_: `var(--md-comp-text-primary, #333)`,
    _textSecondary_: `var(--md-comp-text-secondary, #666)`,
    _textTertiary_: `var(--md-comp-text-tertiary, #999)`,
    _borderDefault_: `var(--md-comp-border-default, #e0e0e0)`,
    _borderLight_: `var(--md-comp-border-light, #eee)`,
    ...props,
  }
}

/** Palette shorthand for special renderers */
const CV = {
  bg: `var(--md-comp-bg, #fff)`,
  bgSec: `var(--md-comp-bg-secondary, #f5f5f5)`,
  bgStripe: `var(--md-comp-bg-stripe, #fafafa)`,
  txtP: `var(--md-comp-text-primary, #333)`,
  txtS: `var(--md-comp-text-secondary, #666)`,
  txtT: `var(--md-comp-text-tertiary, #999)`,
  border: `var(--md-comp-border-default, #e0e0e0)`,
  borderL: `var(--md-comp-border-light, #eee)`,
}

// Special renderers (JSON arrays etc.)

function renderTableBlock(props: Record<string, string>): string {
  let headers: string[] = []
  let rows: string[][] = []
  try { headers = JSON.parse(props.headers || `[]`) }
  catch { headers = [] }
  try {
    const rawRows = JSON.parse(props.rows || `[]`)
    rows = Array.isArray(rawRows) ? rawRows : []
  }
  catch { rows = [] }

  const striped = props.striped !== `false`
  const caption = props.caption || ``

  const thStyle = `padding: 8px 12px; text-align: left; font-weight: 600; font-size: 13px; color: ${CV.txtS}; background: ${CV.bgSec}; border-bottom: 2px solid ${CV.border};`
  const tdStyle = `padding: 8px 12px; font-size: 13px; color: ${CV.txtP}; border-bottom: 1px solid ${CV.borderL};`

  let html = `<section style="overflow-x: auto; margin: 16px 0;">\n`
  html += `  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">\n`
  if (caption) {
    html += `    <caption style="font-size: 13px; color: ${CV.txtS}; margin-bottom: 8px; text-align: left; caption-side: top;">${escapeHtml(caption)}</caption>\n`
  }
  if (headers.length > 0) {
    html += `    <thead>\n      <tr>\n`
    for (const h of headers) {
      html += `        <th style="${thStyle}">${escapeHtml(String(h))}</th>\n`
    }
    html += `      </tr>\n    </thead>\n`
  }
  html += `    <tbody>\n`
  for (let i = 0; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : []
    const rowStyle = striped && i % 2 === 1 ? ` style="background: ${CV.bgStripe};"` : ``
    html += `      <tr${rowStyle}>\n`
    for (const cell of row) {
      html += `        <td style="${tdStyle}">${escapeHtml(String(cell))}</td>\n`
    }
    html += `      </tr>\n`
  }
  html += `    </tbody>\n  </table>\n</section>`
  return html
}

function renderInfoGrid(props: Record<string, string>): string {
  let items: Array<{ label?: string, value?: string }> = []
  try { items = JSON.parse(props.items || `[]`) }
  catch { items = [] }
  const cols = Math.min(Math.max(Number(props.cols) || 2, 1), 3)
  const colWidth = `${Math.floor(100 / cols)}%`

  let html = `<section style="margin: 16px 0; border: 1px solid ${CV.borderL}; border-radius: 8px; overflow: hidden; background: ${CV.bg};">\n`
  html += `  <section style="display: table; width: 100%; border-collapse: collapse;">\n`
  for (let r = 0; r < items.length; r += cols) {
    html += `    <section style="display: table-row;">\n`
    for (let c = 0; c < cols; c++) {
      const item = items[r + c]
      const borderBottom = r + cols < items.length ? `1px solid ${CV.borderL}` : `none`
      const borderRight = c < cols - 1 ? `1px solid ${CV.borderL}` : `none`
      html += `      <section style="display: table-cell; width: ${colWidth}; padding: 10px 14px; border-bottom: ${borderBottom}; border-right: ${borderRight}; vertical-align: top; box-sizing: border-box;">\n`
      if (item) {
        html += `        <p style="margin: 0 0 2px; font-size: 11px; color: ${CV.txtT}; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(item.label || ``)}</p>\n`
        html += `        <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${CV.txtP};">${escapeHtml(item.value || ``)}</p>\n`
      }
      html += `      </section>\n`
    }
    html += `    </section>\n`
  }
  html += `  </section>\n</section>`
  return html
}

// Chat block (WeChat-safe): renders [A]/[B] role messages as left/right bubbles.
// No color-mix(), no pseudo-element content — only block/flex + rounded bubbles.

interface ChatMessage {
  role: string
  text: string
}

const CHAT_LINE_REGEX = /^\[([^\]]+)\](.*)$/

/**
 * Parse raw `[Role] text` lines into messages. A line that does not match the
 * `[Role]` prefix is treated as a continuation of the previous bubble, so
 * multi-line messages stay grouped.
 */
function parseChatChildren(children: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  let last: ChatMessage | null = null
  for (const rawLine of children.split(`\n`)) {
    const line = rawLine.trim()
    if (!line)
      continue
    const match = line.match(CHAT_LINE_REGEX)
    if (match) {
      const message: ChatMessage = { role: match[1]!.trim(), text: match[2]!.trimStart() }
      messages.push(message)
      last = message
    }
    else if (last) {
      last.text += `\n${line}`
    }
  }
  return messages
}

/**
 * Parse a JSON array of messages. Accepts both `[role, text]` tuples and
 * `{ role, text }` objects as items.
 */
function parseChatMessages(raw: string): ChatMessage[] {
  let data: unknown = null
  try {
    data = JSON.parse(raw)
  }
  catch {
    return []
  }
  if (!Array.isArray(data))
    return []
  return data.map((item): ChatMessage => {
    if (Array.isArray(item))
      return { role: String(item[0] ?? ``), text: String(item[1] ?? ``) }
    if (item && typeof item === `object`) {
      const obj = item as Record<string, unknown>
      return { role: String(obj.role ?? ``), text: String(obj.text ?? ``) }
    }
    return { role: ``, text: String(item ?? ``) }
  })
}

function chatDisplayName(role: string, props: Record<string, string>): string {
  if (role === `A`)
    return props.nameA || `A`
  if (role === `B`)
    return props.nameB || `B`
  return role
}

function chatAvatarUrl(role: string, props: Record<string, string>): string {
  if (role === `A`)
    return props.avatarA || ``
  if (role === `B`)
    return props.avatarB || ``
  return ``
}

/** Avatar: image when a URL is given, otherwise a neutral initial block. */
function renderChatAvatar(role: string, props: Record<string, string>): string {
  const url = chatAvatarUrl(role, props)
  if (url) {
    return `<div class="md-chat-avatar"><img src="${escapeHtml(url)}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;display:block;" /></div>`
  }
  const name = chatDisplayName(role, props)
  const letter = name ? escapeHtml(name.slice(0, 1)) : `?`
  return `<div class="md-chat-avatar" style="width:36px;height:36px;border-radius:6px;background:#c8c8c8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;flex:0 0 auto;">${letter}</div>`
}

/**
 * Render a WeChat-safe chat block: an optional title plus a row of bubbles per
 * message. The `me` role is right-aligned; others are left-aligned.
 */
function renderChatBlock(props: Record<string, string>): string {
  const children = (props.children || ``).trim()
  // Prefer inline [A]/[B] lines; fall back to the JSON `messages` prop.
  const messages = children ? parseChatChildren(children) : parseChatMessages(props.messages || ``)

  const title = props.title ? escapeHtml(props.title) : ``
  const me = props.me || `B`

  const rows = messages.map((message) => {
    const isMe = message.role === me
    const name = escapeHtml(chatDisplayName(message.role, props))
    const text = escapeHtml(message.text)
    const avatar = renderChatAvatar(message.role, props)
    const bubbleBg = isMe ? `#95ec69` : `#ffffff`
    const bodyAlign = isMe ? `text-align:right;` : ``
    const bubbleMargin = isMe ? `margin-left:8px;margin-right:0;` : `margin-right:8px;margin-left:0;`
    return `<div class="md-chat-row ${isMe ? `md-chat-right` : `md-chat-left`}" style="display:flex;align-items:flex-start;margin:10px 0;${isMe ? `flex-direction:row-reverse;` : ``}">
  ${avatar}
  <div class="md-chat-body" style="max-width:75%;${bubbleMargin}${bodyAlign}">
    <div class="md-chat-name" style="font-size:12px;color:#999;margin:0 0 4px;${bodyAlign}">${name}</div>
    <div class="md-chat-bubble" style="display:inline-block;padding:8px 12px;border-radius:8px;font-size:14px;line-height:1.5;color:#333;background:${bubbleBg};text-align:left;word-break:break-word;white-space:pre-wrap;">${text}</div>
  </div>
</div>`
  }).join(``)

  const titleHtml = title
    ? `<p class="md-chat-title" style="font-size:13px;font-weight:600;color:#666;margin:0 0 8px;">${title}</p>`
    : ``

  return `<section class="md-chat" style="margin:16px 0;padding:12px;box-sizing:border-box;background:var(--md-comp-bg-secondary,#f5f5f5);border-radius:8px;">
  ${titleHtml}
  ${rows}
</section>`
}

/** Split a list prop on both ASCII and full-width commas. */
function splitList(value?: string): string[] {
  return (value ?? ``).split(/[,，]/).map(s => s.trim()).filter(Boolean)
}

/**
 * 杂志封面卡（祖母绿版式）：眉标条 → 划线引题 → 双色大标题 → 渐变短条 →
 * 副标 → 主色作者栏。卡片由封面自带，正文排在白底上，所以主题容器不再画卡片。
 *
 * 装饰节点里放 `&nbsp;`：微信会清洗空标签承载的形状。
 * 不用 flex `gap`（微信不稳），间距一律 margin。
 */
function renderCoverBlock(props: Record<string, string>): string {
  const esc = (v?: string) => escapeHtml(v ?? ``)
  const chips = splitList(props.chips)

  const eyebrowRow = (props.eyebrow || props.date)
    ? `<section style="display: flex;align-items: center;margin-bottom: 28px;">
  <span style="font-size: 11px;font-weight: 700;letter-spacing: 3px;color: var(--md-primary-color, #059669);">${esc(props.eyebrow)}</span>
  <section style="flex: 1 1 0%;height: 1px;overflow: hidden;background: linear-gradient(to right, var(--md-primary-wash, rgba(5, 150, 105, 0.12)), transparent);margin: 0 8px;"><span>&nbsp;</span></section>
  <span style="font-size: 10px;color: #d1d5db;font-weight: 600;">${esc(props.date)}</span>
</section>`
    : ``

  const kickerRow = props.kicker
    ? `<p style="font-size: 15px;color: #d1d5db;margin: 0px 0px 6px;text-decoration: line-through;letter-spacing: 0.5px;">${esc(props.kicker)}</p>`
    : ``

  const accentHtml = props.accent
    ? `<span style="color: var(--md-primary-color, #059669);">${esc(props.accent)}</span>`
    : ``

  const titleRow = props.title
    ? `<p style="font-size: 24px;font-weight: 900;color: rgb(17, 24, 39);margin: 0px;line-height: 1.05;letter-spacing: -2px;">${esc(props.title)}${accentHtml}</p>`
    : ``

  const title2Row = props.title2
    ? `<p style="font-size: 24px;font-weight: 900;color: var(--md-primary-color, #059669);margin: 0px 0px 16px;line-height: 1.05;letter-spacing: -2px;">${esc(props.title2)}</p>`
    : ``

  const underline = `<section style="width: 48px;height: 3px;background: linear-gradient(to right, var(--md-primary-color, #059669), var(--md-primary-halo, #10b981));border-radius: 2px;margin-bottom: 12px;"><span>&nbsp;</span></section>`

  const subtitleRow = props.subtitle
    ? `<p style="font-size: 13px;color: rgb(156, 163, 175);margin: 0px;line-height: 1.7;letter-spacing: 0.5px;">${esc(props.subtitle)}</p>`
    : ``

  const chipsHtml = chips.length
    ? `<section>${chips.map(c => `<span style="background: rgba(255, 255, 255, 0.2);padding: 1px 6px;border-radius: 3px;font-size: 8px;color: rgb(255, 255, 255);font-weight: 600;margin-left: 4px;">${esc(c)}</span>`).join(``)}</section>`
    : `<section></section>`

  const authorRow = `<section style="background: linear-gradient(135deg, var(--md-primary-color, #059669), var(--md-primary-halo, #10b981));padding: 12px 28px;display: flex;align-items: center;justify-content: space-between;">
  <p style="font-size: 12px;color: rgba(255, 255, 255, 0.9);margin: 0px;font-weight: 600;letter-spacing: 0.5px;">${esc(props.author)}</p>
  ${chipsHtml}
</section>`

  return `<section class="md-cover" style="margin: 0px -8px 32px;border: 1.5px solid var(--md-primary-edge, rgba(5, 150, 105, 0.15));border-radius: 20px;overflow: hidden;box-shadow: rgba(0, 0, 0, 0.06) 0px 4px 20px;background: #ffffff;">
<section style="padding: 32px 28px 28px;">${eyebrowRow}${kickerRow}${titleRow}${title2Row}${underline}${subtitleRow}</section>
${authorRow}
</section>`
}

/**
 * 可横滑的分节目录卡：`items` 用分号分隔，每项 `编号|标题|英文副标`。
 * 首张为主色实心卡（当前章节），其余为白底描边卡。
 */
function renderPartCards(props: Record<string, string>): string {
  const esc = (v?: string) => escapeHtml(v ?? ``)
  const items = (props.items ?? ``)
    .split(`;`)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.split(`|`))

  const cards = items.map(([num, title, sub], index) => {
    const first = index === 0
    const skin = first
      ? `background: linear-gradient(135deg, var(--md-primary-color, #059669), var(--md-primary-halo, #10b981));`
      : `background: rgb(255, 255, 255);border: 1px solid rgb(229, 231, 235);box-shadow: rgba(0, 0, 0, 0.04) 0px 2px 6px;`
    const labelColor = first ? `rgba(255, 255, 255, 0.7)` : `rgb(156, 163, 175)`
    const titleColor = first ? `rgb(255, 255, 255)` : `rgb(17, 24, 39)`
    const subColor = first ? `rgba(255, 255, 255, 0.7)` : `rgb(156, 163, 175)`

    return `<section style="display: inline-block;white-space: normal;vertical-align: top;width: 110px;border-radius: 12px;padding: 12px;margin-right: 8px;${skin}">
  <p style="font-size: 9px;font-weight: 700;color: ${labelColor};letter-spacing: 1px;margin: 0px 0px 5px;">${esc(num)}</p>
  <p style="font-size: 13px;font-weight: 800;color: ${titleColor};margin: 0px 0px 3px;">${esc(title ?? ``)}</p>
  <p style="font-size: 10px;color: ${subColor};margin: 0px;">${esc(sub ?? ``)}</p>
</section>`
  }).join(`<span>&nbsp;</span>`)

  return `<section class="md-parts" style="margin: 0px 0px 32px;">
<section style="display: flex;align-items: center;justify-content: space-between;margin-bottom: 10px;">
  <p style="font-size: 10px;color: rgb(156, 163, 175);margin: 0px;letter-spacing: 2px;font-weight: 600;">${esc(props.label)}</p>
  <p style="font-size: 10px;color: rgb(156, 163, 175);margin: 0px;">${esc(props.hint)}</p>
</section>
<section style="overflow-x: scroll;white-space: nowrap;padding-bottom: 8px;">${cards}</section>
</section>`
}

const SPECIAL_RENDERERS: Record<string, (props: Record<string, string>) => string> = {
  TableBlock: renderTableBlock,
  InfoGrid: renderInfoGrid,
  ChatBlock: renderChatBlock,
  CoverBlock: renderCoverBlock,
  PartCards: renderPartCards,
}

// TipBlock type colors

const TIP_COLORS: Record<string, { borderColor: string, bgColor: string, textColor: string }> = {
  info: { borderColor: `#1890ff`, bgColor: `#e6f7ff`, textColor: `#0050b3` },
  success: { borderColor: `#52c41a`, bgColor: `#f6ffed`, textColor: `#135200` },
  warning: { borderColor: `#faad14`, bgColor: `#fffbe6`, textColor: `#874d00` },
  danger: { borderColor: `#ff4d4f`, bgColor: `#fff2f0`, textColor: `#a8071a` },
}

function injectTipColors(props: Record<string, string>): Record<string, string> {
  const type = props.type || `info`
  const colors = TIP_COLORS[type] || TIP_COLORS.info
  return { ...colors, ...props }
}

// Template engine

/**
 * Recursive template: {{#each}}, {{#if}}/{{#else}}, {{#unless}}, {{prop}} (escaped), {{children}} (raw HTML)
 */
function processTemplate(html: string, props: Record<string, string>): string {
  // {{#each}} — non-greedy; nested #if/#unless OK, not nested #each
  html = html.replace(/\{\{#each\s+([\w-]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, propKey, body) => {
    let items: unknown[]
    try { items = JSON.parse(props[propKey] || `[]`) }
    catch { items = [] }
    if (!Array.isArray(items))
      return ``

    return items.map((item, index) => {
      let itemBody = body
      itemBody = itemBody.replace(/\{\{@index\}\}/g, String(index))
      if (typeof item === `object` && item !== null) {
        const obj = item as Record<string, unknown>
        itemBody = itemBody.replace(/\{\{item\.([\w-]+)\}\}/g, (_: string, key: string) => {
          return obj[key] !== undefined ? escapeHtml(String(obj[key])) : ``
        })
      }
      else {
        itemBody = itemBody.replace(/\{\{item\}\}/g, escapeHtml(String(item ?? ``)))
      }
      return processTemplate(itemBody, props)
    }).join(``)
  })

  html = html.replace(/\{\{#if\s+([\w-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    const elseIdx = content.indexOf(`{{#else}}`)
    if (elseIdx >= 0) {
      return props[key] ? content.slice(0, elseIdx) : content.slice(elseIdx + 9)
    }
    return props[key] ? content : ``
  })

  html = html.replace(/\{\{#unless\s+([\w-]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_, key, content) => {
    return !props[key] ? content : ``
  })

  html = html.replace(/\{\{([\w-]+)\}\}/g, (_, key) => {
    if (key === `children`)
      return props[key] ?? ``
    return props[key] !== undefined ? escapeHtml(props[key]) : ``
  })

  return html
}

/** Render component def + props to HTML (SPECIAL_RENDERERS or template; CSS vars for dark mode). */
function renderTemplate(def: CustomComponentDef, rawProps: Record<string, string>): string {
  const props: Record<string, string> = {}
  for (const propDef of def.props) {
    if (propDef.default !== undefined) {
      props[propDef.name] = propDef.default
    }
  }
  Object.assign(props, rawProps)

  const specialRenderer = SPECIAL_RENDERERS[def.name]
  if (specialRenderer) {
    return specialRenderer(props)
  }

  const propsWithPalette = injectPaletteVars(
    def.name === `TipBlock` ? injectTipColors(props) : props,
  )

  return processTemplate(def.template, propsWithPalette)
}

/** Preview component HTML for editor UI */
export function previewComponent(
  def: CustomComponentDef,
  propsOverride?: Record<string, string>,
): string {
  return renderTemplate(def, propsOverride ?? {})
}

// Mutable registry (updated at render time via setComponentRegistry)

let _registry: ComponentRegistry = {}

export function setComponentRegistry(registry: ComponentRegistry): void {
  _registry = registry
}

export function getBuiltInRegistry(): ComponentRegistry {
  const reg: ComponentRegistry = {}
  for (const c of BUILT_IN_COMPONENTS) {
    reg[c.name] = c
  }
  return reg
}

/**
 * marked extension: JSX-style custom components (PascalCase names).
 * Self-closing: <Component prop="value" />
 * With children: <Component prop="value">children</Component>
 */
const DEFAULT_UNKNOWN_COMPONENT = `Unknown component: {name}`

export function markedComponent(
  getRegistry?: () => ComponentRegistry,
  getRenderMessages?: () => { unknownComponent?: string } | undefined,
): MarkedExtension {
  function resolveRegistry(): ComponentRegistry {
    return getRegistry ? getRegistry() : _registry
  }

  function formatUnknownComponent(name: string): string {
    const template = getRenderMessages?.()?.unknownComponent || DEFAULT_UNKNOWN_COMPONENT
    return template.split(`{name}`).join(name)
  }

  function readComponentName(src: string, from: number): string {
    let i = from
    while (i < src.length && /\w/.test(src[i]))
      i++
    return src.slice(from, i)
  }

  function isInlineComponentName(name: string): boolean {
    return isInlineSystemComponent(name) || resolveRegistry()[name]?.inline === true
  }

  function findLineEnd(src: string, from: number): number {
    const newlineIdx = src.indexOf(`\n`, from)
    return newlineIdx >= 0 ? newlineIdx : src.length
  }

  function hasOnlyWhitespaceToLineEnd(src: string, from: number): boolean {
    return src.slice(from, findLineEnd(src, from)).trim() === ``
  }

  /**
   * Cheap rejection before the line walk below: a component tag always starts
   * `<` immediately followed by an uppercase letter. marked calls `start()` at
   * every block boundary with the whole remaining source, and most documents
   * contain no component at all, so this native scan keeps the common case off
   * the per-line path entirely.
   */
  function hasComponentCandidate(src: string, limit: number): boolean {
    let from = 0
    for (;;) {
      const index = indexOfWithin(src, `<`, from, limit)
      if (index === -1)
        return false
      const next = src.charCodeAt(index + 1)
      if (next >= 65 && next <= 90)
        return true
      from = index + 1
    }
  }

  /** Length of a leading ``` / ~~~ fence on the line at `lineStart`, else 0. */
  function fenceRunLength(src: string, lineStart: number, lineEnd: number): { char: string, length: number } | null {
    let i = lineStart
    let indent = 0
    while (i < lineEnd && src[i] === ` ` && indent < 3) {
      i++
      indent++
    }
    const char = src[i]
    if (char !== `\`` && char !== `~`)
      return null
    let length = 0
    while (i + length < lineEnd && src[i + length] === char)
      length++
    return length >= 3 ? { char, length } : null
  }

  function findComponentStart(src: string): number | undefined {
    const limit = blockScanLimit(src)
    if (!hasComponentCandidate(src, limit))
      return undefined

    let fenceChar = ``
    let fenceLength = 0
    let lineStart = 0

    while (lineStart <= limit) {
      const lineEnd = findLineEnd(src, lineStart)
      const fence = fenceRunLength(src, lineStart, lineEnd)

      if (fenceChar) {
        if (fence && fence.char === fenceChar && fence.length >= fenceLength) {
          fenceChar = ``
          fenceLength = 0
        }
      }
      else if (fence) {
        fenceChar = fence.char
        fenceLength = fence.length
      }
      else {
        const next = src.charCodeAt(lineStart + 1)
        if (src[lineStart] === `<` && next >= 65 && next <= 90) {
          const name = readComponentName(src, lineStart + 1)
          if (!isInlineComponentName(name))
            return lineStart
        }
      }

      lineStart = lineEnd + 1
    }

    return undefined
  }

  /** Non-regex tag parser (avoids catastrophic backtracking). Returns raw, name, propsStr. */
  function parseTag(src: string) {
    function findClosingTag(src: string, name: string, from: number): number {
      const closeTag = `</${name}>`
      let lineStart = from
      let fenceChar = ``
      let fenceLength = 0

      while (lineStart <= src.length) {
        const lineEnd = findLineEnd(src, lineStart)
        const line = src.slice(lineStart, lineEnd)
        const fenceMatch = line.match(/^ {0,3}([`~]{3,})/)

        if (fenceChar) {
          if (fenceMatch && fenceMatch[1][0] === fenceChar && fenceMatch[1].length >= fenceLength) {
            fenceChar = ``
            fenceLength = 0
          }
        }
        else if (fenceMatch) {
          fenceChar = fenceMatch[1][0]
          fenceLength = fenceMatch[1].length
        }
        else {
          const leadingWhitespace = line.match(/^\s*/)?.[0].length ?? 0
          if (line.slice(leadingWhitespace).startsWith(closeTag)
            && line.slice(leadingWhitespace + closeTag.length).trim() === ``) {
            return lineStart + leadingWhitespace
          }
        }

        if (lineEnd === src.length)
          break

        lineStart = lineEnd + 1
      }

      return -1
    }

    if (src[0] !== `<` || src[1] < `A` || src[1] > `Z`)
      return null

    const name = readComponentName(src, 1)
    if (!name || isInlineComponentName(name))
      return null
    const i = 1 + name.length

    // Scan open tag; respect > inside quoted attribute values
    let inQuote = ``
    let j = i
    while (j < src.length) {
      const ch = src[j]
      if (inQuote) {
        if (ch === inQuote)
          inQuote = ``
      }
      else if (ch === `"` || ch === `'`) {
        inQuote = ch
      }
      else if (ch === `/` && src[j + 1] === `>`) {
        if (!hasOnlyWhitespaceToLineEnd(src, j + 2))
          return null
        return { raw: src.slice(0, j + 2), name, propsStr: src.slice(i, j).trim(), children: `` }
      }
      else if (ch === `>`) {
        const lineEnd = findLineEnd(src, j + 1)
        const closeTag = `</${name}>`

        // Same-line open/close OK; nothing else on the line after close tag
        const inlineCloseIdx = src.indexOf(closeTag, j + 1)
        if (inlineCloseIdx >= 0 && inlineCloseIdx < lineEnd) {
          if (src.slice(inlineCloseIdx + closeTag.length, lineEnd).trim() !== ``)
            return null

          const children = src.slice(j + 1, inlineCloseIdx)
          return { raw: src.slice(0, inlineCloseIdx + closeTag.length), name, propsStr: src.slice(i, j).trim(), children }
        }

        if (!hasOnlyWhitespaceToLineEnd(src, j + 1))
          return null

        // Multiline: close tag on its own line; skip matches inside fenced code
        const closeIdx = findClosingTag(src, name, lineEnd === src.length ? lineEnd : lineEnd + 1)
        if (closeIdx < 0)
          return null
        const children = src.slice(j + 1, closeIdx)
        return { raw: src.slice(0, closeIdx + closeTag.length), name, propsStr: src.slice(i, j).trim(), children }
      }
      j++
    }
    return null
  }

  return {
    extensions: [
      {
        name: `mdComponent`,
        level: `block`,

        start(src: string) {
          return findComponentStart(src)
        },

        tokenizer(src: string) {
          const tag = parseTag(src)
          if (!tag)
            return undefined
          return {
            type: `mdComponent`,
            raw: tag.raw,
            name: tag.name,
            propsStr: tag.propsStr,
            children: tag.children,
          }
        },

        renderer(token) {
          const { name, propsStr, children } = token as unknown as { name: string, propsStr: string, children: string }
          const def = resolveRegistry()[name]
          if (!def) {
            return `<p style="color:#f00;font-size:12px;">[${formatUnknownComponent(name)}]</p>\n`
          }
          const props = parseProps(propsStr)
          // Pass inner HTML as children prop (unescaped)
          if (children && props.children === undefined) {
            props.children = children
          }
          return `${renderTemplate(def, props)}\n`
        },
      },
    ],
  }
}

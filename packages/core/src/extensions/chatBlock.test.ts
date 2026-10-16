import { describe, expect, it } from 'vitest'
import { initRenderer } from '../renderer/renderer-impl'
import { renderMarkdown } from '../utils/markdownHelpers'

function render(markdown: string, opts: Record<string, unknown> = {}): string {
  return renderMarkdown(markdown, initRenderer(opts)).html
}

const SAMPLE_CHAT = `<ChatBlock title="项目群" me="B" nameA="小红" nameB="我">
[A] 在吗？帮我看下这段代码
[B] 在的，发过来吧
[A] 好的，谢谢！
</ChatBlock>`

describe(`chatBlock built-in component`, () => {
  it(`renders a chat container with a title`, () => {
    const html = render(SAMPLE_CHAT)

    expect(html).toContain(`class="md-chat"`)
    expect(html).toContain(`class="md-chat-title"`)
    expect(html).toContain(`项目群`)
  })

  it(`renders left/right bubbles with speaker names and message text`, () => {
    const html = render(SAMPLE_CHAT)

    expect(html).toContain(`md-chat-left`)
    expect(html).toContain(`md-chat-right`)
    // Speaker names from nameA / nameB.
    expect(html).toContain(`>小红<`)
    expect(html).toContain(`>我<`)
    // Message bodies.
    expect(html).toContain(`在吗？帮我看下这段代码`)
    expect(html).toContain(`在的，发过来吧`)
    expect(html).toContain(`好的，谢谢！`)
  })

  it(`puts the "me" role (B) on the right and the other (A) on the left`, () => {
    const html = render(SAMPLE_CHAT)

    const firstLeft = html.indexOf(`md-chat-left`)
    const firstRight = html.indexOf(`md-chat-right`)
    expect(firstLeft).toBeGreaterThanOrEqual(0)
    expect(firstRight).toBeGreaterThanOrEqual(0)
    // First message is [A], which must appear before the first [B] bubble.
    expect(firstLeft).toBeLessThan(firstRight)
    // "me" bubble uses the WeChat green background.
    expect(html).toContain(`#95ec69`)
  })

  it(`falls back to raw role letters when no display name is given`, () => {
    const html = render(`<ChatBlock me="B">
[A] hello
[B] hi
</ChatBlock>`)

    expect(html).toContain(`>A<`)
    expect(html).toContain(`>B<`)
  })

  it(`supports a JSON messages prop as an alternative to [A]/[B] lines`, () => {
    const html = render(`<ChatBlock messages='[["A","你好"],["B","你好呀"]]' />`)

    expect(html).toContain(`md-chat-left`)
    expect(html).toContain(`md-chat-right`)
    expect(html).toContain(`你好`)
    expect(html).toContain(`你好呀`)
  })

  it(`renders an avatar image when a URL is supplied, letter block otherwise`, () => {
    const html = render(`<ChatBlock avatarB="https://example.com/a.png">
[A] 在吗？
[B] 在的
</ChatBlock>`)

    // Role B uses the supplied image.
    expect(html).toContain(`<img src="https://example.com/a.png"`)
    // Role A (no avatar) falls back to the neutral initial block.
    expect(html).toContain(`#c8c8c8`)
  })

  it(`renders an initial block when no avatar URL is given`, () => {
    const html = render(`<ChatBlock>
[A] 在吗？
[B] 在的
</ChatBlock>`)

    expect(html).toContain(`#c8c8c8`)
  })

  it(`keeps the visible left/right role text inside bubbles (no raw [A]/[B] leaking)`, () => {
    const html = render(SAMPLE_CHAT)

    expect(html).not.toContain(`[A] `)
    expect(html).not.toContain(`[B] `)
  })
})

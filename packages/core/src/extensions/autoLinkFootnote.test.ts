import { describe, expect, it } from 'vitest'
import { initRenderer } from '../renderer/renderer-impl'
import { renderMarkdown } from '../utils/markdownHelpers'

function render(markdown: string, opts: Record<string, unknown> = {}): string {
  return renderMarkdown(markdown, initRenderer(opts)).html
}

describe(`autoLinkFootnote extension`, () => {
  it(`keeps behaviour unchanged when disabled (default)`, () => {
    const html = render(`See [Doocs](https://github.com/doocs) for details.`)

    expect(html).not.toContain(`md-link-ref`)
    expect(html).not.toContain(`md-references`)
    expect(html).toContain(`<a href="https://github.com/doocs"`)
  })

  it(`appends a references list and markers when enabled`, () => {
    const html = render(`See [Doocs](https://github.com/doocs) for details.`, {
      autoLinkFootnote: true,
    })

    expect(html).toContain(`md-link-ref`)
    expect(html).toContain(`md-references`)
    expect(html).toContain(`参考文献 / References`)
    // The URL is listed at the end and the inline link is preserved.
    expect(html).toContain(`https://github.com/doocs`)
    // Inline text kept.
    expect(html).toContain(`Doocs`)
  })

  it(`keeps the visible link text and only adds a marker`, () => {
    const html = render(`[Doocs](https://github.com/doocs)`, { autoLinkFootnote: true })

    expect(html).toContain(`>Doocs<sup class="md-link-ref">[1]</sup></a>`)
    expect((html.match(/md-link-ref/g) ?? []).length).toBe(1)
  })

  it(`deduplicates repeated URLs into a single reference entry`, () => {
    const html = render(`[A](https://example.com/x) and [B](https://example.com/x)`, {
      autoLinkFootnote: true,
    })

    // Two inline markers...
    expect((html.match(/md-link-ref/g) ?? []).length).toBe(2)
    // ...but a single listed entry.
    expect((html.match(/<li>/g) ?? []).length).toBe(1)
    // URL appears twice inline plus twice in the single reference entry (href + text).
    expect((html.match(/https:\/\/example\.com\/x/g) ?? []).length).toBe(4)
  })

  it(`does not touch WeChat article links`, () => {
    const html = render(`[post](https://mp.weixin.qq.com/s/abc)`, {
      autoLinkFootnote: true,
    })

    expect(html).not.toContain(`md-link-ref`)
    expect(html).not.toContain(`md-references`)
  })

  it(`does not touch internal anchors`, () => {
    const html = render(`Jump to [section](#my-section)`, { autoLinkFootnote: true })

    expect(html).not.toContain(`md-link-ref`)
    expect(html).not.toContain(`md-references`)
    expect(html).toContain(`href="#my-section"`)
  })
})

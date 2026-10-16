import { describe, expect, it } from 'vitest'
import { initRenderer } from '../renderer/renderer-impl'
import { renderMarkdown } from '../utils/markdownHelpers'

function render(markdown: string, opts: Record<string, unknown> = {}): string {
  return renderMarkdown(markdown, initRenderer(opts)).html
}

describe(`imageGallery extension`, () => {
  it(`wraps 2 consecutive images in a 2-column grid container`, () => {
    const html = render(`![a](https://example.com/1.png)\n\n![b](https://example.com/2.png)`)

    expect(html).toContain(`class="md-image-gallery"`)
    expect(html).toContain(`data-cols="2"`)

    const gallery = html.match(/<section class="md-image-gallery"[^>]*>[\s\S]*?<\/section>/)
    expect(gallery).toBeTruthy()
    expect((gallery?.[0].match(/<figure/g) ?? []).length).toBe(2)
    // No third figure leaks in (single gallery for the pair).
    expect((gallery?.[0].match(/data-cols/g) ?? []).length).toBe(1)
  })

  it(`wraps 3 consecutive images in a 3-column grid container`, () => {
    const html = render(
      `![a](https://example.com/1.png)\n\n![b](https://example.com/2.png)\n\n![c](https://example.com/3.png)`,
    )

    expect(html).toContain(`data-cols="3"`)
    const gallery = html.match(/<section class="md-image-gallery"[^>]*>[\s\S]*?<\/section>/)
    expect((gallery?.[0].match(/<figure/g) ?? []).length).toBe(3)
  })

  it(`leaves a single image unwrapped (keeps original width)`, () => {
    const html = render(`![a](https://example.com/1.png)`)

    expect(html).not.toContain(`md-image-gallery`)
    expect(html).toContain(`<figure`)
    expect(html).toContain(`src="https://example.com/1.png"`)
  })

  it(`does not wrap images separated by a paragraph of text`, () => {
    const html = render(
      `![a](https://example.com/1.png)\n\nSome text in between.\n\n![b](https://example.com/2.png)`,
    )

    expect(html).not.toContain(`md-image-gallery`)
  })

  it(`respects imageGallery: false (no gallery even with consecutive images)`, () => {
    const html = render(
      `![a](https://example.com/1.png)\n\n![b](https://example.com/2.png)`,
      { imageGallery: false },
    )

    expect(html).not.toContain(`md-image-gallery`)
  })
})

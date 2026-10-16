import { describe, expect, it } from 'vitest'
import {
  buildXiaohongshuCaption,
  stripMarkdownToPlain,
  XIAOHONGSHU_DEFAULT_BODY_EXCERPT,
  XIAOHONGSHU_TITLE_MAX,
} from './xiaohongshu'

describe(`buildXiaohongshuCaption`, () => {
  it(`truncates an over-long title to the platform limit`, () => {
    const title = `字`.repeat(25)
    const caption = buildXiaohongshuCaption(`正文内容`, title)
    const [head] = caption.split(`\n\n`)

    expect(head).toBe(`${`字`.repeat(XIAOHONGSHU_TITLE_MAX)}…`)
    expect(Array.from(head).length).toBe(XIAOHONGSHU_TITLE_MAX + 1)
    expect(caption).toContain(`正文内容`)
  })

  it(`keeps a title that is exactly at the limit`, () => {
    const title = `字`.repeat(XIAOHONGSHU_TITLE_MAX)
    const caption = buildXiaohongshuCaption(`x`, title)
    expect(caption.split(`\n\n`)[0]).toBe(title)
  })

  it(`extracts the title from the first heading and drops it from the body`, () => {
    const caption = buildXiaohongshuCaption(`# Hello\n\nWorld **bold** [link](http://a)`)
    expect(caption).toBe(`Hello\n\nWorld bold link`)
  })

  it(`falls back to the first non-heading line as the title`, () => {
    const caption = buildXiaohongshuCaption(`前言第一行\n\n正文`)
    expect(caption).toBe(`前言第一行\n\n正文`)
  })

  it(`flattens Markdown syntax into plain text`, () => {
    const md = `**粗体** 和 _斜体_，[链接](https://x.com)，\`代码\``
    const caption = buildXiaohongshuCaption(md, `T`)
    expect(caption).toBe(`T\n\n粗体 和 斜体，链接，代码`)
  })

  it(`truncates the body to the default excerpt length with an ellipsis`, () => {
    const body = `字`.repeat(500)
    const caption = buildXiaohongshuCaption(body, `T`)
    const [, bodyPart] = caption.split(`\n\n`)

    expect(Array.from(bodyPart).length).toBe(XIAOHONGSHU_DEFAULT_BODY_EXCERPT + 1)
    expect(bodyPart.endsWith(`…`)).toBe(true)
  })

  it(`honours a custom body length`, () => {
    const caption = buildXiaohongshuCaption(`字`.repeat(50), `T`, 10)
    const [, bodyPart] = caption.split(`\n\n`)
    expect(bodyPart).toBe(`${`字`.repeat(10)}…`)
  })

  it(`returns an empty string when there is nothing to show`, () => {
    expect(buildXiaohongshuCaption(``)).toBe(``)
    expect(buildXiaohongshuCaption(`   `, ``)).toBe(``)
  })
})

describe(`stripMarkdownToPlain`, () => {
  it(`drops images, fences and shortcodes`, () => {
    const md = `![alt](https://img.png)\n\n\`\`\`js\nconst a = 1\n\`\`\`\n\n结束`
    const plain = stripMarkdownToPlain(md)
    expect(plain).not.toContain(`![`)
    expect(plain).not.toContain(`const a = 1`)
    expect(plain).toContain(`结束`)
  })

  it(`removes list, quote and heading markers`, () => {
    const plain = stripMarkdownToPlain(`## 标题\n\n> 引用\n\n- 项目一\n- 项目二`)
    expect(plain).toBe(`标题\n\n引用\n\n项目一\n项目二`)
  })
})

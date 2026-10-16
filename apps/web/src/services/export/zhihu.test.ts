// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { toZhihuHtml } from './zhihu'

describe(`toZhihuHtml`, () => {
  it(`unwraps WeChat containers and strips md-* classes / juice noise`, () => {
    const input = `
      <div id="output">
        <section class="container md-theme">
          <h1 class="md-heading" style="font-size: 24px; margin: 0 0 16px">标题</h1>
          <p style="margin: 0; padding: 4px; font-size: 16px; color: rgb(63, 63, 63); text-align: center; font-weight: bold">正文 <span class="md-inline">重点</span></p>
        </section>
      </div>`

    const output = toZhihuHtml(input)

    expect(output).not.toContain(`<section`)
    expect(output).not.toContain(`class=`)
    expect(output).not.toContain(`md-`)
    expect(output).not.toContain(`font-size`)
    expect(output).not.toContain(`margin`)
    expect(output).not.toContain(`padding`)
    expect(output).toContain(`<h1>标题</h1>`)
    expect(output).toContain(`text-align: center`)
    expect(output).toContain(`font-weight: bold`)
    expect(output).toContain(`正文 重点`)
  })

  it(`keeps the semantic tags and structure (headings, lists, quote, code, table, link, emphasis, image)`, () => {
    const input = `
      <h2>H2</h2>
      <ul><li>a</li><li>b</li></ul>
      <ol><li>1</li></ol>
      <blockquote><p>quote</p></blockquote>
      <pre><code class="language-js">const a = 1</code></pre>
      <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
      <p><a class="md-link" href="https://x.com">link</a> <strong style="font-size: 15px">bold</strong> <em>emu</em> <img src="https://img.png" alt="pic" width="120" height="80"></p>`

    const output = toZhihuHtml(input)

    expect(output).toContain(`<h2>H2</h2>`)
    expect(output).toContain(`<ul><li>a</li><li>b</li></ul>`)
    expect(output).toContain(`<ol><li>1</li></ol>`)
    expect(output).toContain(`<blockquote><p>quote</p></blockquote>`)
    expect(output).toContain(`<pre><code>const a = 1</code></pre>`)
    expect(output).toContain(`<th>A</th>`)
    expect(output).toContain(`<td>1</td>`)
    expect(output).toContain(`<a href="https://x.com">link</a>`)
    expect(output).toContain(`<strong>bold</strong>`)
    expect(output).toContain(`<em>emu</em>`)
    expect(output).toContain(`<img src="https://img.png" alt="pic">`)

    expect(output).not.toContain(`class=`)
    expect(output).not.toContain(`width=`)
    expect(output).not.toContain(`height=`)
    expect(output).not.toContain(`style=`) // the only inline style was font-size (dropped)
  })

  it(`drops forbidden subtrees and empty spacer paragraphs`, () => {
    const input = `<style>p{color:red}</style><p>&nbsp;</p><p>real</p><script>alert(1)</script><svg><rect></rect></svg>`

    const output = toZhihuHtml(input)

    expect(output).not.toContain(`<style`)
    expect(output).not.toContain(`<script`)
    expect(output).not.toContain(`<svg`)
    expect(output).not.toContain(`&nbsp;`)
    expect(output).toContain(`<p>real</p>`)
  })

  it(`keeps semantic styles (text-align / border) but drops layout noise`, () => {
    const input = `<section style="padding: 8px; background: url(x)"><p style="text-align: justify; line-height: 2; border-bottom: 1px solid #eee">段落</p></section>`

    const output = toZhihuHtml(input)

    expect(output).toContain(`text-align: justify`)
    expect(output).toContain(`border-bottom: 1px solid #eee`)
    expect(output).not.toContain(`line-height`)
    expect(output).not.toContain(`padding`)
    expect(output).not.toContain(`background`)
    expect(output).not.toContain(`<section`)
    expect(output).not.toContain(`<span`)
  })

  it(`returns an empty string for empty or whitespace-only input`, () => {
    expect(toZhihuHtml(``)).toBe(``)
    expect(toZhihuHtml(`   \n  `)).toBe(``)
  })
})

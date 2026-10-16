// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { documentToMarkdown, htmlToMarkdown } from './html-to-markdown'

describe(`htmlToMarkdown`, () => {
  it(`returns an empty string for empty input`, () => {
    expect(htmlToMarkdown(``)).toBe(``)
    expect(htmlToMarkdown(`   `)).toBe(``)
  })

  it(`converts headings and paragraphs`, () => {
    expect(htmlToMarkdown(`<h1>Title</h1><h2>Sub</h2><p>Body</p>`)).toBe(
      `# Title\n\n## Sub\n\nBody`,
    )
  })

  it(`converts inline emphasis`, () => {
    expect(htmlToMarkdown(`<p>Hello <strong>bold</strong> and <em>italic</em> and <del>gone</del></p>`))
      .toBe(`Hello **bold** and *italic* and ~~gone~~`)
  })

  it(`uses the semantic tags <b> and <i> too`, () => {
    expect(htmlToMarkdown(`<p><b>a</b><i>b</i></p>`)).toBe(`**a***b*`)
  })

  it(`converts links`, () => {
    expect(htmlToMarkdown(`<p>See <a href="https://example.com/x">here</a> now</p>`))
      .toBe(`See [here](https://example.com/x) now`)
  })

  it(`drops javascript: links but keeps their text`, () => {
    expect(htmlToMarkdown(`<p><a href="javascript:alert(1)">click</a></p>`)).toBe(`click`)
  })

  it(`converts images with alt and title`, () => {
    expect(htmlToMarkdown(`<p><img src="https://img/x.png" alt="cover" title="Cover"></p>`))
      .toBe(`![cover](https://img/x.png "Cover")`)
  })

  it(`ignores images without a source`, () => {
    expect(htmlToMarkdown(`<p><img alt="broken"></p>`)).toBe(``)
  })

  it(`converts inline code`, () => {
    expect(htmlToMarkdown(`<p>run <code>pnpm test</code> now</p>`)).toBe(`run \`pnpm test\` now`)
  })

  it(`converts fenced code blocks and keeps the language`, () => {
    expect(htmlToMarkdown(`<pre><code class="language-js">const a = 1\nconst b = 2</code></pre>`))
      .toBe('```js\nconst a = 1\nconst b = 2\n```')
  })

  it(`converts fenced code blocks without a language`, () => {
    expect(htmlToMarkdown(`<pre><code>plain</code></pre>`)).toBe('```\nplain\n```')
  })

  it(`converts an unordered list`, () => {
    expect(htmlToMarkdown(`<ul><li>One</li><li>Two</li></ul>`)).toBe(`- One\n- Two`)
  })

  it(`converts an ordered list`, () => {
    expect(htmlToMarkdown(`<ol><li>First</li><li>Second</li></ol>`)).toBe(`1. First\n2. Second`)
  })

  it(`respects an ordered list start attribute`, () => {
    expect(htmlToMarkdown(`<ol start="3"><li>Third</li><li>Fourth</li></ol>`))
      .toBe(`3. Third\n4. Fourth`)
  })

  it(`indents nested lists`, () => {
    expect(htmlToMarkdown(`<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>`))
      .toBe(`- a\n    - b\n- c`)
  })

  it(`converts blockquotes`, () => {
    expect(htmlToMarkdown(`<blockquote><p>quoted line</p></blockquote>`)).toBe(`> quoted line`)
  })

  it(`converts horizontal rules`, () => {
    expect(htmlToMarkdown(`<p>a</p><hr><p>b</p>`)).toBe(`a\n\n---\n\nb`)
  })

  it(`turns <br> into a newline`, () => {
    expect(htmlToMarkdown(`<p>a<br>b</p>`)).toBe(`a\nb`)
  })

  it(`converts a table into a GFM table`, () => {
    const html = `<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Ann</td><td>20</td></tr></tbody></table>`
    expect(htmlToMarkdown(html)).toBe(`| Name | Age |\n| --- | --- |\n| Ann | 20 |`)
  })

  it(`escapes pipes inside table cells`, () => {
    const html = `<table><tr><th>h</th></tr><tr><td>a|b</td></tr></table>`
    expect(htmlToMarkdown(html)).toBe(`| h |\n| --- |\n| a\\|b |`)
  })

  it(`uses the first row as header when no <thead> is present`, () => {
    const html = `<table><tr><td>x</td><td>y</td></tr><tr><td>1</td><td>2</td></tr></table>`
    expect(htmlToMarkdown(html)).toBe(`| x | y |\n| --- | --- |\n| 1 | 2 |`)
  })

  it(`converts a rich mixed document end to end`, () => {
    const html = `<h1>Post</h1><p>Intro with <a href="https://a.b">link</a>.</p><ul><li>one</li></ul>`
    expect(htmlToMarkdown(html)).toBe(`# Post\n\nIntro with [link](https://a.b).\n\n- one`)
  })
})

describe(`htmlToMarkdown Word cleanup`, () => {
  it(`strips o:p, mso styles, comments and spacer spans`, () => {
    const html = `<!--StartFragment-->
      <div class=WordSection1>
        <p class=MsoNormal style='mso-margin-top-alt:auto'><b style='mso-bidi-font-weight:normal'>Title</b><o:p></o:p></p>
        <p class=MsoNormal><span style='mso-spacerun:yes'> </span>Hello <span style='mso-bidi-font-weight:bold'>world</span><o:p></o:p></p>
      </div>
      <!--EndFragment-->`

    const md = htmlToMarkdown(html)

    expect(md).toBe(`**Title**\n\nHello **world**`)
    expect(md).not.toContain(`mso`)
    expect(md).not.toContain(`<o:p>`)
    expect(md).not.toContain(`StartFragment`)
    expect(md).not.toContain(`WordSection1`)
  })

  it(`converts a Word bulleted paragraph into a list item`, () => {
    const html = `<p class=MsoListParagraph style='text-indent:-.25in;mso-list:l0 level1 lfo1'>`
      + `<span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'> </span></span>First item</p>`
    expect(htmlToMarkdown(html)).toBe(`- First item`)
  })

  it(`converts a Word numbered paragraph into an ordered item`, () => {
    const html = `<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'>`
      + `<span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'> </span></span>Step one</p>`
      + `<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'>`
      + `<span style='mso-list:Ignore'>2.<span style='font:7.0pt "Times New Roman"'> </span></span>Step two</p>`
    expect(htmlToMarkdown(html)).toBe(`1. Step one\n\n2. Step two`)
  })

  it(`drops stylesheet and script noise`, () => {
    const html = `<style>.a{color:red}</style><script>alert(1)</script><p>Kept</p>`
    expect(htmlToMarkdown(html)).toBe(`Kept`)
  })
})

describe(`documentToMarkdown`, () => {
  it(`converts a parsed document`, () => {
    const doc = new DOMParser().parseFromString(`<p>hello <b>there</b></p>`, `text/html`)
    expect(documentToMarkdown(doc)).toBe(`hello **there**`)
  })
})

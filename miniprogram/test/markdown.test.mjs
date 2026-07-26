import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function loadMarkdown() {
  const source = await readFile(new URL('../utils/markdown.js', import.meta.url), 'utf8')
  const module = { exports: {} }
  const context = vm.createContext({ module, exports: module.exports })
  new vm.Script(source, { filename: 'markdown.js' }).runInContext(context)
  return module.exports
}

const { mdToHtml, mdToPlain } = await loadMarkdown()

test('mdToHtml renders headings bold lists and links', () => {
  const html = mdToHtml('## 标题\n\n**加粗** 与 *斜体*\n\n- 一项\n- 二项\n\n[官网](https://example.com)')
  assert.match(html, /<h2>/)
  assert.match(html, /<strong>加粗<\/strong>/)
  assert.match(html, /<em>斜体<\/em>/)
  assert.match(html, /<ul>/)
  assert.match(html, /<a href="https:\/\/example.com">官网<\/a>/)
})

test('mdToHtml escapes raw html', () => {
  const html = mdToHtml('<script>alert(1)</script>')
  assert.ok(!html.includes('<script>'))
  assert.match(html, /&lt;script&gt;/)
})

test('mdToPlain strips markdown for previews', () => {
  const plain = mdToPlain('## Hello\n\n**world** and [x](https://a.com)')
  assert.equal(plain, 'Hello world and x')
})

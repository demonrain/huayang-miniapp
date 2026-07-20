import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = process.cwd()
const miniRoot = path.join(root, 'miniprogram')

function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    if (name === '.git' || name === 'node_modules') return []
    const filename = path.join(directory, name)
    return statSync(filename).isDirectory() ? walk(filename) : [filename]
  })
}

const files = walk(root).filter(filename => !filename.includes(`${path.sep}data${path.sep}`) && !filename.includes(`${path.sep}media${path.sep}`))

for (const filename of files.filter(item => item.endsWith('.json'))) {
  JSON.parse(readFileSync(filename, 'utf8'))
}

for (const filename of files.filter(item => item.endsWith('.mjs'))) {
  if (filename === import.meta.filename) continue
  execFileSync(process.execPath, ['--check', filename], { stdio: 'pipe' })
}

for (const filename of files.filter(item => item.endsWith('.js'))) {
  new vm.Script(readFileSync(filename, 'utf8'), { filename })
}

const appConfig = JSON.parse(readFileSync(path.join(miniRoot, 'app.json'), 'utf8'))
for (const page of appConfig.pages) {
  for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
    const filename = path.join(miniRoot, `${page}${extension}`)
    if (!files.includes(filename)) throw new Error(`Missing page file: ${filename}`)
  }
}

const allowedTags = new Set(['view', 'text', 'image', 'button', 'input', 'scroll-view'])
const voidTags = new Set(['image', 'input'])
for (const filename of files.filter(item => item.endsWith('.wxml'))) {
  const source = readFileSync(filename, 'utf8')
  const stack = []
  for (const match of source.matchAll(/<\/?([a-zA-Z][\w-]*)\b[^>]*>/g)) {
    const tag = match[1]
    if (!allowedTags.has(tag)) throw new Error(`Unsupported WXML tag <${tag}> in ${filename}`)
    if (voidTags.has(tag) || match[0].endsWith('/>')) continue
    if (match[0].startsWith('</')) {
      if (stack.pop() !== tag) throw new Error(`Unbalanced </${tag}> in ${filename}`)
    } else {
      stack.push(tag)
    }
  }
  if (stack.length) throw new Error(`Unclosed <${stack.at(-1)}> in ${filename}`)
}

console.log(`Validated ${appConfig.pages.length} mini program pages and ${files.length} project files.`)

/**
 * Lightweight Markdown → HTML / plain text for announcement content.
 * Only emits a safe subset of tags for WeChat rich-text (no raw HTML passthrough).
 */

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text) {
  let s = escapeHtml(text)
  // code
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  // images ![alt](url) — render as link text (mini program may block external img)
  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<span>[$1]</span>')
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  // bold ** ** or __ __
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // italic * * or _ _
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
  // strikethrough ~~ ~~
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return s
}

/**
 * Convert markdown source to HTML string suitable for rich-text.
 */
function mdToHtml(source) {
  const raw = String(source ?? '').replace(/\r\n/g, '\n').trim()
  if (!raw) return ''

  const lines = raw.split('\n')
  const html = []
  let i = 0
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      closeLists()
      i += 1
      continue
    }

    // fenced code block
    if (trimmed.startsWith('```')) {
      closeLists()
      const codeLines = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]))
        i += 1
      }
      if (i < lines.length) i += 1
      html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`)
      continue
    }

    // headings
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      closeLists()
      const level = heading[1].length
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    // blockquote
    if (trimmed.startsWith('> ')) {
      closeLists()
      const quote = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      html.push(`<blockquote>${inlineMarkdown(quote.join(' '))}</blockquote>`)
      continue
    }

    // hr
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeLists()
      html.push('<hr/>')
      i += 1
      continue
    }

    // unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        html.push('<ul>')
        inUl = true
      }
      html.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*+]\s+/, ''))}</li>`)
      i += 1
      continue
    }

    // ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        html.push('<ol>')
        inOl = true
      }
      html.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</li>`)
      i += 1
      continue
    }

    closeLists()
    // paragraph: merge consecutive non-empty plain lines
    const para = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next) break
      if (/^(#{1,3}\s|>\s|[-*+]\s|\d+\.\s|```|(-{3,}|\*{3,}|_{3,})$)/.test(next)) break
      para.push(next)
      i += 1
    }
    html.push(`<p>${para.map(inlineMarkdown).join('<br/>')}</p>`)
  }

  closeLists()
  return html.join('')
}

/**
 * Strip markdown markers to plain single-line-ish text (for list previews).
 */
function mdToPlain(source) {
  let s = String(source ?? '').replace(/\r\n/g, '\n')
  s = s.replace(/```[\s\S]*?```/g, ' ')
  s = s.replace(/^#{1,3}\s+/gm, '')
  s = s.replace(/^>\s?/gm, '')
  s = s.replace(/^[-*+]\s+/gm, '')
  s = s.replace(/^\d+\.\s+/gm, '')
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  s = s.replace(/`([^`]+)`/g, '$1')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/_([^_]+)_/g, '$1')
  s = s.replace(/~~([^~]+)~~/g, '$1')
  s = s.replace(/[ \t]+\n/g, '\n')
  s = s.replace(/\n+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

module.exports = {
  mdToHtml,
  mdToPlain,
  escapeHtml
}

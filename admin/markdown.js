/**
 * Same lightweight Markdown helpers as miniprogram/utils/markdown.js (browser global).
 */
;(function (global) {
  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function inlineMarkdown(text) {
    let s = escapeHtml(text)
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>')
    s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<span>[$1]</span>')
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>')
    return s
  }

  function mdToHtml(source) {
    const raw = String(source ?? '').replace(/\r\n/g, '\n').trim()
    if (!raw) return ''
    const lines = raw.split('\n')
    const html = []
    let i = 0
    let inUl = false
    let inOl = false
    const closeLists = () => {
      if (inUl) { html.push('</ul>'); inUl = false }
      if (inOl) { html.push('</ol>'); inOl = false }
    }
    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()
      if (!trimmed) { closeLists(); i += 1; continue }
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
      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        closeLists()
        const level = heading[1].length
        html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
        i += 1
        continue
      }
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
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        closeLists()
        html.push('<hr/>')
        i += 1
        continue
      }
      if (/^[-*+]\s+/.test(trimmed)) {
        if (inOl) { html.push('</ol>'); inOl = false }
        if (!inUl) { html.push('<ul>'); inUl = true }
        html.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*+]\s+/, ''))}</li>`)
        i += 1
        continue
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        if (inUl) { html.push('</ul>'); inUl = false }
        if (!inOl) { html.push('<ol>'); inOl = true }
        html.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</li>`)
        i += 1
        continue
      }
      closeLists()
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
    s = s.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
    return s
  }

  global.HuayangMarkdown = { mdToHtml, mdToPlain, escapeHtml }
})(typeof window !== 'undefined' ? window : globalThis)

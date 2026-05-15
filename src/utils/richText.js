function rgbToHex(rgb) {
  if (!rgb) return null
  if (rgb.startsWith('#')) return rgb
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return '#' + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('')
}

// Parse contentEditable innerHTML into paragraphs of runs: [[ {text, fontSize, color} ]]
export function parseHtmlRuns(html, defaultFontSize = 22, defaultColor = '#ffffff') {
  if (!html?.trim()) return []

  const container = document.createElement('div')
  container.innerHTML = html

  const paragraphs = []
  let currentPara = []

  function pushLine() {
    paragraphs.push(currentPara.length
      ? [...currentPara]
      : [{ text: '', fontSize: defaultFontSize, color: defaultColor }]
    )
    currentPara = []
  }

  function walk(node, fontSize, color) {
    if (node.nodeType === 3 /* TEXT */) {
      const t = node.textContent
      if (t) currentPara.push({ text: t, fontSize, color })
      return
    }
    if (node.nodeType !== 1 /* ELEMENT */) return

    const tag = node.tagName.toLowerCase()
    const s = node.style || {}
    const fs  = s.fontSize ? parseFloat(s.fontSize) : fontSize
    const clr = s.color ? (rgbToHex(s.color) ?? color) : color

    if (tag === 'br') { pushLine(); return }

    const isBlock = tag === 'div' || tag === 'p'
    if (isBlock && (currentPara.length > 0 || paragraphs.length > 0)) pushLine()
    for (const child of node.childNodes) walk(child, fs, clr)
    if (isBlock) pushLine()
  }

  for (const child of container.childNodes) walk(child, defaultFontSize, defaultColor)
  if (currentPara.length > 0) paragraphs.push(currentPara)

  return paragraphs
}

// Word-wrap paragraphs into visual lines for canvas rendering.
// Returns { lines: [{ tokens: [{text, fontSize, color, width}], lineHeight }], totalHeight }
export function layoutRuns(ctx, paragraphs, font, maxW) {
  const lines = []

  for (const para of paragraphs) {
    if (!para.length || (para.length === 1 && !para[0].text)) {
      const sz = para[0]?.fontSize || 22
      lines.push({ tokens: [], lineHeight: sz * 1.4 })
      continue
    }

    // Tokenize into words, preserving whitespace tokens so spacing is correct
    const words = []
    for (const run of para) {
      for (const part of run.text.split(/(\s+)/)) {
        if (part) words.push({ text: part, fontSize: run.fontSize, color: run.color })
      }
    }

    let line = []
    let lineW = 0

    const flushLine = () => {
      if (!line.length) return
      const maxSz = Math.max(...line.map(t => t.fontSize))
      lines.push({ tokens: line, lineHeight: maxSz * 1.4 })
      line = []; lineW = 0
    }

    for (const word of words) {
      ctx.font = `400 ${word.fontSize}px "${font}", Georgia, sans-serif`
      const w = ctx.measureText(word.text).width
      if (lineW + w > maxW && lineW > 0 && word.text.trim()) flushLine()
      line.push({ ...word, width: w })
      lineW += w
    }
    flushLine()
  }

  const totalHeight = lines.reduce((s, l) => s + l.lineHeight, 0)
  return { lines, totalHeight }
}

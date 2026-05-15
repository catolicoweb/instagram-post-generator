import { parseHtmlRuns, layoutRuns } from './richText.js'

const imageCache = new Map()

export function loadImage(url) {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url))
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imageCache.set(url, img); resolve(img) }
    img.onerror = reject
    img.src = url
  })
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawQuoteBg(canvas, post, w, h, imgObj, cropPos, imgScale, scale) {
  const ctx = canvas.getContext('2d')
  const cw = w * scale
  const ch = h * scale
  canvas.width = cw
  canvas.height = ch

  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, cw, ch)

  if (imgObj) {
    ctx.drawImage(
      imgObj,
      cropPos.x * scale,
      cropPos.y * scale,
      imgObj.width * imgScale * scale,
      imgObj.height * imgScale * scale,
    )
  }

  if (post.overlayOpacity > 0) {
    const hex = post.overlayColor || '#000000'
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    ctx.fillStyle = `rgba(${r},${g},${b},${post.overlayOpacity})`
    ctx.fillRect(0, 0, cw, ch)
  }

  const quote = post.quote || ''
  const author = post.author || ''
  if (!quote && !author) return

  const pad = 36 * scale
  const maxW = cw - pad * 2
  const quoteSize = Number(post.quoteSize) * scale
  const authorSize = Number(post.authorSize) * scale
  const lineH = quoteSize * 1.35

  ctx.font = `400 ${quoteSize}px "${post.quoteFont}", Georgia, serif`
  const lines = quote ? wrapText(ctx, quote, maxW) : []
  const decorSize = quoteSize * 2.2

  ctx.font = `400 ${authorSize}px "${post.authorFont}", Georgia, serif`
  const authorLines = author ? wrapText(ctx, author, maxW) : []
  const authorLineH = authorSize * 1.3

  const date     = post.date || ''
  const dateSize = authorSize * 0.82
  const dateGap  = authorSize * 0.55

  const blockH = decorSize * 0.5 + lines.length * lineH
    + (authorLines.length ? authorSize * 0.6 + authorLines.length * authorLineH : 0)
    + (date && authorLines.length ? dateGap + dateSize : 0)

  let startY
  if (post.textPosition === 'top') startY = pad + decorSize * 0.5
  else if (post.textPosition === 'bottom') startY = ch - pad - blockH
  else startY = (ch - blockH) / 2

  ctx.font = `700 ${decorSize}px "${post.quoteFont}", Georgia, serif`
  ctx.fillStyle = post.textColor || '#ffffff'
  ctx.globalAlpha = 0.5
  ctx.textBaseline = 'top'
  ctx.fillText('"', pad - decorSize * 0.1, startY)
  ctx.globalAlpha = 1

  ctx.font = `400 ${quoteSize}px "${post.quoteFont}", Georgia, serif`
  ctx.fillStyle = post.textColor || '#ffffff'
  ctx.textBaseline = 'top'
  lines.forEach((line, i) => {
    ctx.fillText(line, pad, startY + decorSize * 0.55 + i * lineH)
  })

  if (authorLines.length) {
    ctx.font = `400 ${authorSize}px "${post.authorFont}", Georgia, serif`
    ctx.fillStyle = post.textColor || '#ffffff'
    ctx.globalAlpha = 0.75
    const authorStartY = startY + decorSize * 0.55 + lines.length * lineH + authorSize * 0.6
    authorLines.forEach((line, i) => {
      ctx.fillText(line, pad, authorStartY + i * authorLineH)
    })
    if (date) {
      ctx.font = `${post.dateWeight || '400'} ${dateSize}px "${post.authorFont}", Georgia, serif`
      ctx.fillStyle = post.dateColor || (post.textColor || '#ffffff')
      ctx.globalAlpha = post.dateColor ? 1 : 0.5
      ctx.fillText(date, pad, authorStartY + authorLines.length * authorLineH + dateGap)
    }
    ctx.globalAlpha = 1
  }
}

function drawSaintDay(canvas, post, w, h, imgObj, cropPos, imgScale, scale) {
  const ctx = canvas.getContext('2d')
  const cw = w * scale
  const ch = h * scale
  canvas.width = cw
  canvas.height = ch

  const fontFace = `"${post.quoteFont || 'EB Garamond'}", Georgia, serif`
  const color = post.textColor || '#ffffff'
  const pad = 24 * scale
  const maxW = cw * 0.82

  const circleR = Math.min(cw, ch) * 0.20
  const nameSize = Number(post.quoteSize || 26) * scale
  const descSize = Number(post.authorSize || 18) * scale

  // Measure text to know total block height before drawing
  ctx.font = `700 ${nameSize}px ${fontFace}`
  const nameLines = post.saintName ? wrapText(ctx, post.saintName, maxW) : []
  ctx.font = `400 ${descSize}px ${fontFace}`
  const descLines = post.description ? wrapText(ctx, post.description, maxW) : []
  const hasDate = !!post.date

  let blockH = circleR * 2 + 26 * scale
  if (nameLines.length) blockH += nameLines.length * nameSize * 1.22 + 16 * scale
  if (descLines.length) blockH += descLines.length * descSize * 1.45 + 22 * scale
  if (hasDate) blockH += 18 * scale + descSize

  // Vertical alignment of the whole block
  const pos = post.textPosition || 'middle'
  let startY
  if (pos === 'top') startY = pad
  else if (pos === 'bottom') startY = Math.max(pad, ch - pad - blockH)
  else startY = Math.max(pad, (ch - blockH) / 2)

  const circleCx = cw / 2
  const circleCy = startY + circleR

  // Background
  ctx.fillStyle = post.bgColor || '#7a9170'
  ctx.fillRect(0, 0, cw, ch)

  // Circle image — clipped to arc, positioned via cropPos/imgScale like other templates
  if (imgObj) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(circleCx, circleCy, circleR, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(
      imgObj,
      cropPos.x * scale,
      cropPos.y * scale,
      imgObj.width * imgScale * scale,
      imgObj.height * imgScale * scale,
    )
    ctx.restore()
  }

  let y = circleCy + circleR + 26 * scale
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'

  // Saint name
  if (nameLines.length) {
    ctx.font = `700 ${nameSize}px ${fontFace}`
    ctx.fillStyle = color
    nameLines.forEach((line, i) => {
      ctx.fillText(line, cw / 2, y + i * nameSize * 1.22)
    })
    y += nameLines.length * nameSize * 1.22 + 16 * scale
  }

  // Description
  if (descLines.length) {
    ctx.font = `400 ${descSize}px ${fontFace}`
    ctx.fillStyle = color
    ctx.globalAlpha = 0.82
    descLines.forEach((line, i) => {
      ctx.fillText(line, cw / 2, y + i * descSize * 1.45)
    })
    ctx.globalAlpha = 1
    y += descLines.length * descSize * 1.45 + 22 * scale
  }

  // Divider + date
  if (hasDate) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1 * scale
    ctx.beginPath()
    ctx.moveTo(cw * 0.25, y)
    ctx.lineTo(cw * 0.75, y)
    ctx.stroke()
    y += 18 * scale
    ctx.font = `${post.dateWeight || '500'} ${descSize}px ${fontFace}`
    ctx.fillStyle = post.dateColor || color
    ctx.fillText(post.date, cw / 2, y)
  }

  ctx.textAlign = 'left'
}

function drawSplitQuote(canvas, post, w, h, imgObj, cropPos, imgScale, scale) {
  const ctx = canvas.getContext('2d')
  const cw = w * scale
  const ch = h * scale
  canvas.width = cw
  canvas.height = ch

  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, cw, ch)

  const pad = 28 * scale
  const color = post.textColor || '#4a3025'
  const fontFace = `”${post.quoteFont || 'EB Garamond'}”, Georgia, serif`
  const quoteSize = Number(post.quoteSize || 24) * scale
  const authorSize = Number(post.authorSize || 18) * scale
  const lineH = quoteSize * 1.45
  const authorLineH = authorSize * 1.4
  const date = post.date || ''
  const dateSize = authorSize * 0.82
  const dateGap = authorSize * 0.55
  const dividerH = 3 * scale
  const dividerGap = 20 * scale

  const isHorizontal = post.splitDirection === 'horizontal'

  if (isHorizontal) {
    const imageOnTop = post.imagePosition !== 'bottom'
    const imgPanelY = imageOnTop ? 0 : ch / 2
    const panelY = imageOnTop ? ch / 2 : 0
    const halfH = ch / 2

    if (imgObj) {
      const d = defaultCropPos(imgObj, w, h / 2)
      const effScale = Math.max(imgScale, d.scale)
      const imgDrawW = imgObj.width * effScale * scale
      const imgDrawH = imgObj.height * effScale * scale
      const baseX = (cw - imgDrawW) / 2
      const baseY = imgPanelY + (halfH - imgDrawH) / 2
      const drawX = Math.min(0, Math.max(cw - imgDrawW, baseX + cropPos.x * scale))
      const drawY = Math.min(imgPanelY, Math.max(imgPanelY + halfH - imgDrawH, baseY + cropPos.y * scale))
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, imgPanelY, cw, halfH)
      ctx.clip()
      ctx.drawImage(imgObj, drawX, drawY, imgDrawW, imgDrawH)
      ctx.restore()
    }

    ctx.fillStyle = post.bgColor || '#f0d4b8'
    ctx.fillRect(0, panelY, cw, halfH)

    const maxW = cw - pad * 2
    ctx.font = `400 ${quoteSize}px ${fontFace}`
    const quotedText = post.quote ? `”${post.quote}”` : ''
    const lines = quotedText ? wrapText(ctx, quotedText, maxW) : []
    ctx.font = `500 ${authorSize}px ${fontFace}`
    const authorLines = post.author ? wrapText(ctx, post.author, maxW) : []

    const blockH =
      lines.length * lineH +
      (authorLines.length ? dividerGap + dividerH + dividerGap + authorLines.length * authorLineH : 0) +
      (date && authorLines.length ? dateGap + dateSize : 0)
    const startY = panelY + (halfH - blockH) / 2

    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    if (lines.length) {
      ctx.font = `400 ${quoteSize}px ${fontFace}`
      ctx.fillStyle = color
      lines.forEach((line, i) => ctx.fillText(line, pad, startY + i * lineH))
    }
    if (authorLines.length) {
      const divY = startY + lines.length * lineH + dividerGap
      ctx.fillStyle = color
      ctx.globalAlpha = 0.4
      ctx.fillRect(pad, divY, 36 * scale, dividerH)
      ctx.globalAlpha = 1
      ctx.font = `500 ${authorSize}px ${fontFace}`
      ctx.fillStyle = color
      const authorY = divY + dividerH + dividerGap
      authorLines.forEach((line, i) => ctx.fillText(line, pad, authorY + i * authorLineH))
      if (date) {
        ctx.font = `${post.dateWeight || '400'} ${dateSize}px ${fontFace}`
        ctx.fillStyle = post.dateColor || color
        ctx.globalAlpha = post.dateColor ? 1 : 0.55
        ctx.fillText(date, pad, authorY + authorLines.length * authorLineH + dateGap)
        ctx.globalAlpha = 1
      }
    }
  } else {
    // Vertical split (left / right)
    const imageOnLeft = post.imagePosition !== 'right'
    const imgPanelX = imageOnLeft ? 0 : cw / 2
    const panelX    = imageOnLeft ? cw / 2 : 0
    const halfW     = cw / 2

    if (imgObj) {
      const d = defaultCropPos(imgObj, w / 2, h)
      const effScale = Math.max(imgScale, d.scale)
      const imgDrawW = imgObj.width  * effScale * scale
      const imgDrawH = imgObj.height * effScale * scale
      const baseX = imgPanelX + (halfW - imgDrawW) / 2
      const baseY = (ch - imgDrawH) / 2
      const drawX = Math.min(imgPanelX, Math.max(imgPanelX + halfW - imgDrawW, baseX + cropPos.x * scale))
      const drawY = Math.min(0, Math.max(ch - imgDrawH, baseY + cropPos.y * scale))
      ctx.save()
      ctx.beginPath()
      ctx.rect(imgPanelX, 0, halfW, ch)
      ctx.clip()
      ctx.drawImage(imgObj, drawX, drawY, imgDrawW, imgDrawH)
      ctx.restore()
    }

    ctx.fillStyle = post.bgColor || '#f0d4b8'
    ctx.fillRect(panelX, 0, cw / 2, ch)

    const textLeft = panelX + pad
    const maxW = cw / 2 - pad * 2

    ctx.font = `400 ${quoteSize}px ${fontFace}`
    const quotedText = post.quote ? `”${post.quote}”` : ''
    const lines = quotedText ? wrapText(ctx, quotedText, maxW) : []
    ctx.font = `500 ${authorSize}px ${fontFace}`
    const authorLines = post.author ? wrapText(ctx, post.author, maxW) : []

    const blockH =
      lines.length * lineH +
      (authorLines.length ? dividerGap + dividerH + dividerGap + authorLines.length * authorLineH : 0) +
      (date && authorLines.length ? dateGap + dateSize : 0)
    const startY = (ch - blockH) / 2

    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    if (lines.length) {
      ctx.font = `400 ${quoteSize}px ${fontFace}`
      ctx.fillStyle = color
      lines.forEach((line, i) => ctx.fillText(line, textLeft, startY + i * lineH))
    }
    if (authorLines.length) {
      const divY = startY + lines.length * lineH + dividerGap
      ctx.fillStyle = color
      ctx.globalAlpha = 0.4
      ctx.fillRect(textLeft, divY, 36 * scale, dividerH)
      ctx.globalAlpha = 1
      ctx.font = `500 ${authorSize}px ${fontFace}`
      ctx.fillStyle = color
      const authorY = divY + dividerH + dividerGap
      authorLines.forEach((line, i) => ctx.fillText(line, textLeft, authorY + i * authorLineH))
      if (date) {
        ctx.font = `${post.dateWeight || '400'} ${dateSize}px ${fontFace}`
        ctx.fillStyle = post.dateColor || color
        ctx.globalAlpha = post.dateColor ? 1 : 0.55
        ctx.fillText(date, textLeft, authorY + authorLines.length * authorLineH + dateGap)
        ctx.globalAlpha = 1
      }
    }
  }
}

function drawQuote(canvas, post, w, h, imgObj, cropPos, imgScale, scale) {
  const ctx = canvas.getContext('2d')
  const cw = w * scale
  const ch = h * scale
  canvas.width = cw
  canvas.height = ch

  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, cw, ch)

  if (imgObj) {
    ctx.drawImage(
      imgObj,
      cropPos.x * scale,
      cropPos.y * scale,
      imgObj.width * imgScale * scale,
      imgObj.height * imgScale * scale,
    )
  }

  if (post.overlayOpacity > 0) {
    const hex = post.overlayColor || '#000000'
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    ctx.fillStyle = `rgba(${r},${g},${b},${post.overlayOpacity})`
    ctx.fillRect(0, 0, cw, ch)
  }

  const quote = post.quote || ''
  const author = post.author || ''
  if (!quote && !author) return

  const pad = 40 * scale
  const maxW = cw - pad * 2
  const quoteSize = Number(post.quoteSize) * scale
  const authorSize = Number(post.authorSize) * scale
  const lineH = quoteSize * 1.4
  const authorLineH = authorSize * 1.3
  const date = post.date || ''
  const dateSize = authorSize * 0.82
  const dividerGap = 20 * scale
  const dividerH = 1 * scale

  ctx.font = `400 ${quoteSize}px "${post.quoteFont}", Georgia, serif`
  const lines = quote ? wrapText(ctx, `“${quote}”`, maxW) : []
  ctx.font = `400 ${authorSize}px "${post.authorFont}", Georgia, serif`
  const authorLines = author ? wrapText(ctx, author, maxW) : []

  const blockH =
    lines.length * lineH +
    (authorLines.length ? dividerGap + dividerH + dividerGap + authorLines.length * authorLineH : 0) +
    (date && authorLines.length ? authorSize * 0.5 + dateSize : 0)

  let startY
  if (post.textPosition === 'top') startY = pad
  else if (post.textPosition === 'bottom') startY = ch - pad - blockH
  else startY = (ch - blockH) / 2

  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'

  if (lines.length) {
    ctx.font = `400 ${quoteSize}px "${post.quoteFont}", Georgia, serif`
    ctx.fillStyle = post.textColor || '#ffffff'
    lines.forEach((line, i) => ctx.fillText(line, cw / 2, startY + i * lineH))
  }

  if (authorLines.length) {
    const divY = startY + lines.length * lineH + dividerGap
    ctx.strokeStyle = post.textColor || '#ffffff'
    ctx.globalAlpha = 0.3
    ctx.lineWidth = dividerH
    ctx.beginPath()
    ctx.moveTo(cw / 2 - 30 * scale, divY)
    ctx.lineTo(cw / 2 + 30 * scale, divY)
    ctx.stroke()
    ctx.globalAlpha = 1

    const authorY = divY + dividerH + dividerGap
    ctx.font = `400 ${authorSize}px "${post.authorFont}", Georgia, serif`
    ctx.fillStyle = post.textColor || '#ffffff'
    ctx.globalAlpha = 0.75
    authorLines.forEach((line, i) => ctx.fillText(line, cw / 2, authorY + i * authorLineH))
    if (date) {
      ctx.font = `${post.dateWeight || '400'} ${dateSize}px "${post.authorFont}", Georgia, serif`
      ctx.fillStyle = post.dateColor || (post.textColor || '#ffffff')
      ctx.globalAlpha = post.dateColor ? 1 : 0.5
      ctx.fillText(date, cw / 2, authorY + authorLines.length * authorLineH + authorSize * 0.5)
    }
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'left'
}

function drawSaintHighlight(canvas, post, w, h, imgObj, cropPos, imgScale, scale) {
  const ctx = canvas.getContext('2d')
  const cw = w * scale
  const ch = h * scale
  canvas.width = cw
  canvas.height = ch

  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, cw, ch)

  if (imgObj) {
    ctx.drawImage(
      imgObj,
      cropPos.x * scale,
      cropPos.y * scale,
      imgObj.width * imgScale * scale,
      imgObj.height * imgScale * scale,
    )
  }

  if (post.overlayOpacity > 0) {
    const hex = post.overlayColor || '#000000'
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    ctx.fillStyle = `rgba(${r},${g},${b},${post.overlayOpacity})`
    ctx.fillRect(0, 0, cw, ch)
  }

  const saintName = post.saintName || ''
  const description = post.description || ''
  const date = post.date || ''
  if (!saintName && !description) return

  const pad = 40 * scale
  const maxW = cw - pad * 2
  const nameSize = Number(post.quoteSize) * scale
  const descSize = Number(post.authorSize) * scale
  const dateSize = nameSize * 0.6
  const color = post.textColor || '#ffffff'
  const nameLineH = nameSize * 1.25
  const descLineH = descSize * 1.5
  const dividerGap = 18 * scale

  ctx.font = `500 ${nameSize}px "${post.quoteFont}", Georgia, serif`
  const nameLines = saintName ? wrapText(ctx, saintName, maxW) : []
  ctx.font = `400 ${descSize}px "${post.authorFont}", Georgia, serif`
  const descLines = description ? wrapText(ctx, description, maxW) : []

  const blockH =
    nameLines.length * nameLineH +
    (date ? 14 * scale + dateSize : 0) +
    (descLines.length ? dividerGap + 1 * scale + dividerGap + descLines.length * descLineH : 0)

  let startY
  if (post.textPosition === 'top') startY = pad
  else if (post.textPosition === 'bottom') startY = ch - pad - blockH
  else startY = (ch - blockH) / 2

  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'

  if (nameLines.length) {
    ctx.font = `500 ${nameSize}px "${post.quoteFont}", Georgia, serif`
    ctx.fillStyle = color
    nameLines.forEach((line, i) => ctx.fillText(line, cw / 2, startY + i * nameLineH))
  }

  let y = startY + nameLines.length * nameLineH

  if (date) {
    y += 14 * scale
    ctx.font = `${post.dateWeight || '400'} ${dateSize}px "${post.authorFont}", Georgia, serif`
    ctx.fillStyle = post.dateColor || color
    ctx.globalAlpha = post.dateColor ? 1 : 0.75
    ctx.fillText(date, cw / 2, y)
    ctx.globalAlpha = 1
    y += dateSize
  }

  if (descLines.length) {
    y += dividerGap
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 1 * scale
    ctx.beginPath()
    ctx.moveTo(cw / 2 - 30 * scale, y)
    ctx.lineTo(cw / 2 + 30 * scale, y)
    ctx.stroke()
    ctx.globalAlpha = 1
    y += 1 * scale + dividerGap

    ctx.font = `400 ${descSize}px "${post.authorFont}", Georgia, serif`
    ctx.fillStyle = color
    ctx.globalAlpha = 0.8
    descLines.forEach((line, i) => ctx.fillText(line, cw / 2, y + i * descLineH))
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'left'
}

function drawRichTextOverlay(ctx, post, cw, ch, scale) {
  const html = post.storyRichText
  if (!html?.trim()) return

  const font      = post.storyTextFont    || 'Aleo'
  const align     = post.storyTextAlign   || 'center'
  const bottomPad = (post.storyTextBottom ?? 40) * scale
  const sidePad   = 24 * scale
  const maxW      = cw - sidePad * 2

  const paras = parseHtmlRuns(html, 22, '#ffffff')
    .map(para => para.map(r => ({ ...r, fontSize: r.fontSize * scale })))

  const { lines, totalHeight } = layoutRuns(ctx, paras, font, maxW)
  if (!lines.length) return

  const shadowPresets = {
    subtle: { blur: 4  * scale, offset: 1 * scale, color: 'rgba(0,0,0,0.55)' },
    normal: { blur: 8  * scale, offset: 2 * scale, color: 'rgba(0,0,0,0.75)' },
    strong: { blur: 18 * scale, offset: 3 * scale, color: 'rgba(0,0,0,0.92)' },
  }
  const shadowCfg = shadowPresets[post.storyTextShadow] || null
  if (shadowCfg) {
    ctx.shadowColor   = shadowCfg.color
    ctx.shadowBlur    = shadowCfg.blur
    ctx.shadowOffsetX = shadowCfg.offset
    ctx.shadowOffsetY = shadowCfg.offset
  }

  let y = ch - bottomPad - totalHeight
  ctx.textBaseline = 'top'
  ctx.globalAlpha  = 1

  for (const { tokens, lineHeight } of lines) {
    const lineW = tokens.reduce((s, t) => s + t.width, 0)
    const startX = align === 'left'   ? sidePad
                 : align === 'right'  ? cw - sidePad - lineW
                 : (cw - lineW) / 2

    let x = startX
    for (const token of tokens) {
      ctx.font      = `400 ${token.fontSize}px "${font}", Georgia, sans-serif`
      ctx.fillStyle = token.color
      ctx.fillText(token.text, x, y)
      x += token.width
    }
    y += lineHeight
  }

  // Reset shadow so it doesn't affect other canvas draws
  ctx.shadowColor   = 'transparent'
  ctx.shadowBlur    = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.textAlign = 'left'
}

export function drawPost(canvas, post, w, h, imgObj, cropPos, imgScale, scale = 1) {
  if (post.template === 'saint-day') {
    drawSaintDay(canvas, post, w, h, imgObj, cropPos, imgScale, scale)
  } else if (post.template === 'saint-highlight') {
    drawSaintHighlight(canvas, post, w, h, imgObj, cropPos, imgScale, scale)
  } else if (post.template === 'split-quote') {
    drawSplitQuote(canvas, post, w, h, imgObj, cropPos, imgScale, scale)
  } else if (post.template === 'quote') {
    drawQuote(canvas, post, w, h, imgObj, cropPos, imgScale, scale)
  } else {
    drawQuoteBg(canvas, post, w, h, imgObj, cropPos, imgScale, scale)
  }

  if (post.storyRichText?.trim()) {
    drawRichTextOverlay(canvas.getContext('2d'), post, canvas.width, canvas.height, scale)
  }
}

export function defaultCropPos(imgObj, w, h) {
  if (!imgObj) return { x: 0, y: 0, scale: 1 }
  const scale = Math.max(w / imgObj.width, h / imgObj.height)
  return {
    x: (w - imgObj.width * scale) / 2,
    y: (h - imgObj.height * scale) / 2,
    scale,
  }
}

import { useRef, useEffect, useState } from 'react'
import { drawPost, loadImage, defaultCropPos } from '../utils/drawPost'
import { ensureFonts } from '../utils/fonts'

const EXPORT_SCALE = 3

export default function FormatCanvas({ label, width, height, post, formatKey, cropPos, onCropChange, exportRef }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [imgObj, setImgObj] = useState(null)
  const [imgScale, setImgScale] = useState(1)
  const [localCrop, setLocalCrop] = useState(cropPos || { x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  // Keep latest values accessible inside wheel handler without re-registering
  const stateRef = useRef({ imgObj, imgScale, localCrop })
  useEffect(() => { stateRef.current = { imgObj, imgScale, localCrop } }, [imgObj, imgScale, localCrop])

  // Load image
  // Returns the minimum-zoom crop for the template's image area
  const getDefaultCrop = (img) => {
    const splitDir = post.splitDirections?.[formatKey] ?? post.splitDirection
    const imgPos   = post.imagePositions?.[formatKey]  ?? post.imagePosition
    if (post.template === 'saint-day') {
      const circleD = Math.min(width, height) * 0.40
      const d = defaultCropPos(img, circleD, circleD)
      return { scale: d.scale, x: (width - img.width * d.scale) / 2, y: (height - img.height * d.scale) / 2 }
    }
    if (post.template === 'split-quote') {
      if (splitDir === 'horizontal') {
        const halfH = height / 2
        const d = defaultCropPos(img, width, halfH)
        const panelY = imgPos === 'bottom' ? halfH : 0
        return { scale: d.scale, x: (width - img.width * d.scale) / 2, y: panelY + (halfH - img.height * d.scale) / 2 }
      }
      const halfW  = width / 2
      const d      = defaultCropPos(img, halfW, height)
      const panelX = imgPos === 'right' ? halfW : 0
      return { scale: d.scale, x: panelX + (halfW - img.width * d.scale) / 2, y: (height - img.height * d.scale) / 2 }
    }
    return defaultCropPos(img, width, height)
  }

  useEffect(() => {
    if (!post.imageUrl) { setImgObj(null); return }
    loadImage(post.imageUrl).then(img => {
      const d = getDefaultCrop(img)
      // If user has already saved a custom crop, restore it; otherwise use template default
      const hasSavedCrop = cropPos && (cropPos.x !== 0 || cropPos.y !== 0 || cropPos.scale)
      setImgScale(hasSavedCrop ? (cropPos.scale || d.scale) : d.scale)
      setLocalCrop(hasSavedCrop ? { x: cropPos.x, y: cropPos.y } : { x: d.x, y: d.y })
      setImgObj(img)
    }).catch(() => setImgObj(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.imageUrl, width, height])

  // Sync external cropPos changes (e.g. switching posts)
  useEffect(() => {
    if (cropPos) {
      setLocalCrop({ x: cropPos.x, y: cropPos.y })
      if (cropPos.scale) setImgScale(cropPos.scale)
    }
  }, [cropPos])

  const effectivePost = {
    ...post,
    quoteSize: post.quoteSizes?.[formatKey] ?? post.quoteSize,
    authorSize: post.authorSizes?.[formatKey] ?? post.authorSize,
    splitDirection: post.splitDirections?.[formatKey] ?? post.splitDirection,
    imagePosition: post.imagePositions?.[formatKey] ?? post.imagePosition,
  }

  // Keep a ref to always-current draw args so font-load callbacks use fresh data
  const drawArgsRef = useRef({ effectivePost, imgObj, localCrop, imgScale })
  drawArgsRef.current = { effectivePost, imgObj, localCrop, imgScale }

  const redraw = () => {
    const { effectivePost: ep, imgObj: io, localCrop: lc, imgScale: is } = drawArgsRef.current
    drawPost(canvasRef.current, ep, width, height, io, lc, is, 1)
  }

  // Redraw on any state change (uses whatever fonts are currently in the browser cache)
  useEffect(() => {
    redraw()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, imgObj, localCrop, imgScale, width, height])

  // Redraw after fonts actually load — runs only when the font family changes
  useEffect(() => {
    let active = true
    ensureFonts([post.quoteFont, post.authorFont]).then(() => {
      if (active) redraw()
    })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.quoteFont, post.authorFont])

  // Export
  useEffect(() => {
    if (!exportRef) return
    exportRef.current = {
      exportPNG: () => exportImage('image/png'),
      exportJPG: () => exportImage('image/jpeg'),
    }
  })

  const exportImage = (type) => {
    const offscreen = document.createElement('canvas')
    drawPost(offscreen, effectivePost, width, height, imgObj, localCrop, imgScale, EXPORT_SCALE)
    const ext = type === 'image/png' ? 'png' : 'jpg'
    const a = document.createElement('a')
    a.href = offscreen.toDataURL(type, 0.95)
    a.download = `post_${label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${ext}`
    a.click()
  }

  const isDraggable = !!imgObj

  const applyZoom = (zoomFactor, originX, originY) => {
    const { imgObj: img, imgScale: scale, localCrop: crop } = stateRef.current
    if (!img) return
    const isSaintDay        = post.template === 'saint-day'
    const isSplitQuote      = post.template === 'split-quote'
    const splitDir          = post.splitDirections?.[formatKey] ?? post.splitDirection
    const isHorizontalSplit = isSplitQuote && splitDir === 'horizontal'
    const circleD = Math.min(width, height) * 0.40
    const halfW   = width / 2
    const halfH   = height / 2
    const minScale = isSaintDay
      ? Math.max(circleD / img.width, circleD / img.height)
      : isHorizontalSplit
      ? Math.max(width / img.width, halfH / img.height)
      : isSplitQuote
      ? Math.max(halfW / img.width, height / img.height)
      : Math.max(width / img.width, height / img.height)
    const newScale = Math.min(Math.max(scale * zoomFactor, minScale), minScale * 8)
    // Keep the canvas point (originX, originY) fixed under zoom
    const imgPixelX = (originX - crop.x) / scale
    const imgPixelY = (originY - crop.y) / scale
    let newX = originX - imgPixelX * newScale
    let newY = originY - imgPixelY * newScale
    const imgW = img.width * newScale
    const imgH = img.height * newScale
    if (!isSaintDay && !isSplitQuote) {
      newX = Math.min(0, Math.max(width - imgW, newX))
      newY = Math.min(0, Math.max(height - imgH, newY))
    }
    setImgScale(newScale)
    const next = { x: newX, y: newY }
    setLocalCrop(next)
    onCropChange?.(formatKey, { ...next, scale: newScale })
  }

  // Wheel zoom — registered with passive:false so we can preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      if (!stateRef.current.imgObj) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const originX = e.clientX - rect.left
      const originY = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      applyZoom(factor, originX, originY)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, formatKey])

  // Drag
  const onMouseDown = (e) => {
    if (!imgObj || !isDraggable) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e) => {
    if (!dragging.current || !imgObj) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    const freeForm = post.template === 'saint-day' || post.template === 'split-quote' || post.template === 'saint-highlight'
    const imgW = imgObj.width * imgScale
    const imgH = imgObj.height * imgScale
    // Read from ref so accumulated deltas are always correct between renders
    const base = stateRef.current.localCrop
    const newX = freeForm ? base.x + dx : Math.min(0, Math.max(width - imgW, base.x + dx))
    const newY = freeForm ? base.y + dy : Math.min(0, Math.max(height - imgH, base.y + dy))
    const next = { x: newX, y: newY }
    // Update ref immediately so the next mouse event sees the correct base
    stateRef.current.localCrop = next
    setLocalCrop(next)
    // Call outside the state updater — never side-effect inside a React updater fn
    onCropChange?.(formatKey, { ...next, scale: imgScale })
  }
  const onMouseUp = () => { dragging.current = false }

  const zoomIn  = () => applyZoom(1.15, width / 2, height / 2)
  const zoomOut = () => applyZoom(1 / 1.15, width / 2, height / 2)
  const resetZoom = () => {
    if (!imgObj) return
    const isSaintDay        = post.template === 'saint-day'
    const isSplitQuote      = post.template === 'split-quote'
    const splitDir          = post.splitDirections?.[formatKey] ?? post.splitDirection
    const imgPos            = post.imagePositions?.[formatKey]  ?? post.imagePosition
    const isHorizontalSplit = isSplitQuote && splitDir === 'horizontal'
    const circleD = Math.min(width, height) * 0.40
    const halfW   = width / 2
    const halfH   = height / 2
    const d = isSaintDay
      ? defaultCropPos(imgObj, circleD, circleD)
      : isHorizontalSplit
      ? defaultCropPos(imgObj, width, halfH)
      : isSplitQuote
      ? defaultCropPos(imgObj, halfW, height)
      : defaultCropPos(imgObj, width, height)
    const x = isSaintDay
      ? (width - imgObj.width * d.scale) / 2
      : isHorizontalSplit
      ? (width - imgObj.width * d.scale) / 2
      : isSplitQuote
      ? (imgPos === 'right' ? halfW : 0) + (halfW - imgObj.width * d.scale) / 2
      : d.x
    const y = isSaintDay
      ? (height - imgObj.height * d.scale) / 2
      : isHorizontalSplit
      ? (imgPos === 'bottom' ? halfH : 0) + (halfH - imgObj.height * d.scale) / 2
      : isSplitQuote
      ? (height - imgObj.height * d.scale) / 2
      : d.y
    setImgScale(d.scale)
    setLocalCrop({ x, y })
    onCropChange?.(formatKey, { x, y, scale: d.scale })
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{label}</span>
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        style={{ width, height }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width, height }} />

        {/* Zoom controls — bottom-right overlay */}
        {imgObj && (
          <div
            className="absolute bottom-2 right-2 flex items-center gap-1"
            onMouseDown={e => e.stopPropagation()}
          >
            <button onClick={zoomOut} title="Zoom out" style={zoomBtnStyle}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5h6"/>
              </svg>
            </button>
            <button onClick={resetZoom} title="Reset zoom" style={{ ...zoomBtnStyle, fontSize: 8, fontWeight: 600, padding: '0 5px', width: 'auto' }}>
              FIT
            </button>
            <button onClick={zoomIn} title="Zoom in" style={zoomBtnStyle}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5 2v6M2 5h6"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const zoomBtnStyle = {
  width: 22,
  height: 22,
  borderRadius: 4,
  background: 'rgba(0,0,0,0.55)',
  border: '1px solid rgba(255,255,255,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'white',
  backdropFilter: 'blur(4px)',
}

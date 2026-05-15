import { useRef, useEffect, useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import GridCell from './GridCell'
import WikimediaSearch from './WikimediaSearch'
import { downloadZip } from '../utils/zip'
import { loadImage } from '../utils/drawPost'
import { exportProject, importProject, fileToDataUrl } from '../utils/storage'
import { ensureFont } from '../utils/fonts'

const MAIN_TEMPLATES = [
  { label: 'Full BG', group: ['quote-bg', 'saint-highlight'], switchTo: 'quote-bg' },
  { label: 'Split',   group: ['split-quote'],                  switchTo: 'split-quote' },
  { label: 'Circle',  group: ['saint-day'],                    switchTo: 'saint-day' },
]

function makePost(imageUrl = '', template = 'quote-bg') {
  return {
    id: uuid(),
    imageUrl,
    template,
    // quote-bg / split-quote fields
    quote: '',
    author: '',
    // saint-day fields
    saintName: '',
    description: '',
    date: '',
    bgColor: template === 'split-quote' ? '#f0d4b8' : '#7a9170',
    // split-quote
    splitDirection: 'vertical',
    splitDirections: {},
    imagePosition: 'left',
    imagePositions: {},
    // shared
    reviewed: false,
    cropPos: {},
    quoteFont: 'Aleo',
    authorFont: 'Aleo',
    quoteSize: 24,
    authorSize: 20,
    quoteSizes: { '4x5': 20, '9x16': 14 },
    authorSizes: {},
    textColor: template === 'split-quote' ? '#4a3025' : '#ffffff',
    dateColor: '',
    dateWeight: '400',
    overlayColor: '#000000',
    overlayOpacity: 0.35,
    textPosition: 'bottom',
    // story text overlay (9:16)
    storyRichText: '',
    storyTextFont: 'Aleo',
    storyTextAlign: 'center',
    storyTextBottom: 40,
    storyTextShadow: 'none',
  }
}

// Returns the field changes needed when switching a post to a new template,
// migrating content between saint-day ↔ quote templates automatically.
function templateSwitchChanges(post, toTemplate) {
  const fromTemplate = post.template || 'quote-bg'
  const styleDefaults =
    toTemplate === 'split-quote'    ? { bgColor: '#f0d4b8', textColor: '#4a3025' } :
    toTemplate === 'saint-day'      ? { bgColor: post.bgColor || '#7a9170', textColor: '#ffffff' } :
    { textColor: '#ffffff' }

  const isSaintFrom = fromTemplate === 'saint-day'
  const isSaintTo   = toTemplate   === 'saint-day'

  const contentMigration = {}
  if (isSaintFrom && !isSaintTo) {
    contentMigration.quote  = post.quote || post.description || ''
    contentMigration.author = post.saintName || post.author || ''
  } else if (!isSaintFrom && isSaintTo) {
    contentMigration.description = post.description || post.quote  || ''
    contentMigration.saintName   = post.saintName   || post.author || ''
  }

  return { template: toTemplate, ...styleDefaults, ...contentMigration }
}

// ── Santoral helpers ─────────────────────────────────────────────────────────

const TERRACOTTA_COLORS = [
  '#8B3A2A', '#9E4030', '#7A3528', '#A04832',
  '#6B3025', '#7D3B2C', '#8C4A35', '#B04535', '#954035',
]

const MESES = {
  enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
  julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12,
}

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function parseFecha(fecha) {
  if (!fecha) return { day: 0, month: 0 }
  const parts = fecha.toLowerCase().trim().split(/\s+/)
  return { day: parseInt(parts[0]) || 0, month: MESES[parts[parts.length - 1]] || 0 }
}

function santoralEntryToPost(entry) {
  const hasQuote = !!entry.quote?.trim()
  const terracotta = randomItem(TERRACOTTA_COLORS)

  const description = entry.description || entry.descripcion || ''

  if (!hasQuote) {
    return {
      ...makePost('', 'saint-day'),
      saintName: entry.author || '',
      description,
      date: entry.fecha || '',
      bgColor: terracotta,
      textColor: '#ffffff',
    }
  }

  const template = Math.random() < 0.5 ? 'quote-bg' : 'split-quote'
  return {
    ...makePost('', template),
    quote: entry.quote.trim(),
    author: entry.author || '',
    description,
    date: entry.fecha || '',
    ...(template === 'split-quote'
      ? { bgColor: terracotta, textColor: '#ffffff' }
      : { overlayColor: terracotta, overlayOpacity: 0.85, textColor: '#ffffff' }
    ),
  }
}

function parseSantoralJson(raw) {
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('Se esperaba un array JSON')
  const posts = data.map(santoralEntryToPost)
  // Latest dates first (top of grid), earliest last (bottom)
  posts.sort((a, b) => {
    const fa = parseFecha(a.date)
    const fb = parseFecha(b.date)
    return fb.month !== fa.month ? fb.month - fa.month : fb.day - fa.day
  })
  return posts
}

function toFetchableUrl(url) {
  const m = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return `https://docs.google.com/document/d/${m[1]}/export?format=txt`
  return url
}

// ── Smart URL input row (for URL tab) ────────────────────────────────────────
// Smart URL input row (for URL tab)
function UrlRow({ post, index, isLast, onChange, onDelete, onEnterPressed }) {
  const [status, setStatus] = useState(post.imageUrl ? 'ok' : 'empty')
  const inputRef = useRef(null)

  const handleChange = async (url) => {
    const trimmed = url.trim()
    onChange(trimmed)
    if (!trimmed) { setStatus('empty'); return }
    setStatus('loading')
    try { await loadImage(trimmed); setStatus('ok') }
    catch { setStatus('error') }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (!pasted) return
    e.preventDefault()
    onChange(pasted)
    setStatus('loading')
    loadImage(pasted)
      .then(() => { setStatus('ok'); if (isLast) onEnterPressed() })
      .catch(() => setStatus('error'))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && post.imageUrl && isLast) onEnterPressed()
  }

  const icon = status === 'loading'
    ? <div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
    : status === 'ok'
    ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    : status === 'error'
    ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>

  return (
    <div className="flex items-center gap-1.5 group">
      <div className="w-5 flex items-center justify-center shrink-0">{icon}</div>
      <input
        ref={inputRef}
        type="text"
        value={post.imageUrl}
        placeholder={`Image URL ${index + 1}…`}
        onChange={e => handleChange(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent border-b border-white/10 focus:border-white/35 text-white/70 focus:text-white text-[12px] py-1.5 outline-none transition-colors placeholder:text-white/20"
      />
      {!isLast && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      )}
    </div>
  )
}

const STORY_FONTS = [
  { group: 'Serif',       fonts: ['Aleo', 'Playfair Display', 'EB Garamond', 'Cormorant Garamond', 'Lora', 'Merriweather'] },
  { group: 'Sans Serif',  fonts: ['Montserrat', 'Poppins', 'Inter', 'Raleway', 'DM Sans', 'Barlow'] },
  { group: 'Display',     fonts: ['Abril Fatface', 'Cinzel', 'Italiana', 'Bodoni Moda'] },
  { group: 'Handwriting', fonts: ['Great Vibes', 'Caveat', 'Satisfy', 'Pacifico'] },
]

const STORY_TEXT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80]

function rgbToHex(rgb) {
  if (!rgb) return null
  if (rgb.startsWith('#')) return rgb
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return '#' + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('')
}

function StoryRichEditor({ initialHtml, font, align, onChange }) {
  const editorRef  = useRef(null)
  const savedRange = useRef(null)
  const [activeSize,  setActiveSize]  = useState(22)
  const [activeColor, setActiveColor] = useState('#ffffff')

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml || ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentional: seed only on mount; parent uses key prop to reset

  const saveSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    if (editorRef.current?.contains(range.commonAncestorContainer))
      savedRange.current = range.cloneRange()
  }, [])

  const restoreAndApply = useCallback((fontSize, color) => {
    // Focus editor first — range.addRange() only works reliably in the active element
    editorRef.current?.focus()
    if (savedRange.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }

    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) return
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return

    const fragment = range.extractContents()
    const span = document.createElement('span')
    if (fontSize != null) span.style.fontSize = fontSize + 'px'
    if (color    != null) span.style.color    = color
    span.appendChild(fragment)
    range.insertNode(span)

    // Re-select the inserted span so consecutive changes stack correctly
    const newRange = document.createRange()
    newRange.selectNodeContents(span)
    sel.removeAllRanges()
    sel.addRange(newRange)
    savedRange.current = newRange.cloneRange()

    onChange(editorRef.current.innerHTML)
  }, [onChange])

  const readSelectionStyles = useCallback(() => {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    let node = sel.getRangeAt(0).startContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode
    while (node && node !== editorRef.current) {
      if (node.style?.fontSize) setActiveSize(parseFloat(node.style.fontSize))
      if (node.style?.color) {
        const hex = rgbToHex(node.style.color)
        if (hex) setActiveColor(hex)
      }
      node = node.parentNode
    }
  }, [])

  const inputBase = {
    background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4, color: '#f0f0f0', outline: 'none',
  }
  const iconBtn = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 4, cursor: 'pointer', outline: 'none',
    border: active ? '1px solid rgba(255,255,255,0.45)' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
    transition: 'all 0.1s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Size select */}
        <select
          value={activeSize}
          onChange={e => { const s = Number(e.target.value); setActiveSize(s); restoreAndApply(s, null) }}
          style={{ ...inputBase, fontSize: 11, padding: '3px 4px', width: 60, cursor: 'pointer', appearance: 'auto' }}
        >
          {STORY_TEXT_SIZES.map(s => <option key={s} value={s} style={{ background: '#1a1a1a' }}>{s}px</option>)}
        </select>

        {/* Color — save range on blur, apply in onChange */}
        <div style={{ position: 'relative', width: 26, height: 26 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 4, background: activeColor, border: '1px solid rgba(255,255,255,0.2)', pointerEvents: 'none' }} />
          <input
            type="color"
            value={activeColor}
            onChange={e => { setActiveColor(e.target.value); restoreAndApply(null, e.target.value) }}
            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }}
          />
        </div>

        {/* Align icons */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
          {[
            { val: 'left',   d: 'M2 3h8M2 6h5M2 9h7M2 12h4' },
            { val: 'center', d: 'M1 3h10M2.5 6h7M1.5 9h9M3 12h6' },
            { val: 'right',  d: 'M2 3h8M5 6h5M3 9h7M6 12h4' },
          ].map(({ val, d }) => (
            <button
              key={val}
              onMouseDown={e => e.preventDefault()}
              onClick={() => onChange(editorRef.current?.innerHTML || '')}
              data-align={val}
              style={iconBtn(false)}
              title={val}
            >
              <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d={d}/>
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* contentEditable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Type your story text…"
        onInput={e => onChange(e.currentTarget.innerHTML)}
        onMouseUp={() => { saveSelection(); readSelectionStyles() }}
        onKeyUp={() => { saveSelection(); readSelectionStyles() }}
        onBlur={saveSelection}
        style={{
          minHeight: 90,
          background: '#1e1e1e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
          padding: '8px 10px',
          outline: 'none',
          color: '#f0f0f0',
          fontSize: 22,
          fontFamily: `"${font}", Georgia, serif`,
          textAlign: align,
          lineHeight: 1.4,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}
      />
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: rgba(255,255,255,0.2);
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

function StoryTextPanel({ selectedCount, seed, onApply }) {
  const [html,   setHtml]   = useState(seed?.storyRichText   || '')
  const [font,   setFont]   = useState(seed?.storyTextFont   || 'Aleo')
  const [align,  setAlign]  = useState(seed?.storyTextAlign  || 'center')
  const [bottom, setBottom] = useState(seed?.storyTextBottom ?? 40)
  const [shadow, setShadow] = useState(seed?.storyTextShadow || 'none')

  const handleFontChange = useCallback((f) => { setFont(f); ensureFont(f) }, [])

  const labelStyle = {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)',
    display: 'block', marginTop: 12,
  }
  const inputBase = {
    background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: '#f0f0f0', fontSize: 12, padding: '6px 8px',
    outline: 'none', marginTop: 4, boxSizing: 'border-box',
  }
  const iconBtn = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 28, borderRadius: 4, cursor: 'pointer', outline: 'none',
    border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
    transition: 'all 0.12s',
  })

  const hasContent = !!html.replace(/<[^>]*>/g, '').trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>
        Story Text Overlay
      </span>

      {/* WYSIWYG editor */}
      <span style={{ ...labelStyle, marginTop: 10 }}>Text</span>
      <StoryRichEditor
        key={seed?.id}
        initialHtml={html}
        font={font}
        align={align}
        onChange={setHtml}
      />

      {/* Font + Alignment row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ ...labelStyle, marginTop: 0 }}>Font</span>
          <select
            value={font}
            onChange={e => handleFontChange(e.target.value)}
            style={{ ...inputBase, marginTop: 4, width: '100%', appearance: 'auto', cursor: 'pointer' }}
          >
            {STORY_FONTS.map(({ group, fonts }) => (
              <optgroup key={group} label={group} style={{ background: '#1a1a1a' }}>
                {fonts.map(f => <option key={f} value={f} style={{ background: '#1a1a1a' }}>{f}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Alignment */}
        <div>
          <span style={{ ...labelStyle, marginTop: 0 }}>Align</span>
          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {[
              { val: 'left',   icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.5" rx="0.75"/><rect x="0" y="4" width="8" height="1.5" rx="0.75"/><rect x="0" y="7" width="10" height="1.5" rx="0.75"/><rect x="0" y="10" width="6" height="1.5" rx="0.75"/></svg> },
              { val: 'center', icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.5" rx="0.75"/><rect x="2" y="4" width="8" height="1.5" rx="0.75"/><rect x="1" y="7" width="10" height="1.5" rx="0.75"/><rect x="3" y="10" width="6" height="1.5" rx="0.75"/></svg> },
              { val: 'right',  icon: <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="1" width="12" height="1.5" rx="0.75"/><rect x="4" y="4" width="8" height="1.5" rx="0.75"/><rect x="2" y="7" width="10" height="1.5" rx="0.75"/><rect x="6" y="10" width="6" height="1.5" rx="0.75"/></svg> },
            ].map(({ val, icon }) => (
              <button key={val} onClick={() => setAlign(val)} style={iconBtn(align === val)}>{icon}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom offset */}
      <span style={labelStyle}>Position from bottom</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <input
          type="range"
          min={0} max={400} step={2}
          value={bottom}
          onChange={e => setBottom(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <input
            type="number"
            min={0} max={400}
            value={bottom}
            onChange={e => setBottom(Number(e.target.value))}
            style={{ ...inputBase, marginTop: 0, width: 46, textAlign: 'center', padding: '4px 6px', fontSize: 11 }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>px</span>
        </div>
      </div>

      {/* Shadow */}
      <span style={labelStyle}>Shadow</span>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {[
          { val: 'none',   label: 'None' },
          { val: 'subtle', label: 'Subtle' },
          { val: 'normal', label: 'Normal' },
          { val: 'strong', label: 'Strong' },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setShadow(val)}
            style={{
              ...iconBtn(shadow === val),
              flex: 1, width: 'auto',
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.05em', padding: '4px 2px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Apply */}
      <button
        onClick={() => onApply({ storyRichText: html, storyTextFont: font, storyTextAlign: align, storyTextBottom: bottom, storyTextShadow: shadow })}
        style={{
          marginTop: 14, width: '100%', padding: '9px 14px', borderRadius: 6, border: 'none',
          background: hasContent ? '#ffffff' : 'rgba(255,255,255,0.12)',
          color: hasContent ? '#000000' : 'rgba(255,255,255,0.3)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none', transition: 'all 0.15s',
        }}
      >
        Apply to {selectedCount} {selectedCount === 1 ? 'post' : 'posts'}
      </button>

      {hasContent && (
        <button
          onClick={() => { setHtml(''); onApply({ storyRichText: '', storyTextFont: font, storyTextAlign: align, storyTextBottom: bottom, storyTextShadow: shadow }) }}
          style={{
            marginTop: 6, width: '100%', padding: '7px 14px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
            color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
          }}
        >
          Clear text from selected
        </button>
      )}
    </div>
  )
}

// Mini quick-editor shown in sidebar when a grid cell is selected
function PostQuickPanel({ post, onUpdate, onEdit, onDuplicate }) {
  const inputStyle = {
    width: '100%',
    background: '#1e1e1e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#f0f0f0',
    fontSize: 12,
    padding: '6px 8px',
    outline: 'none',
    marginTop: 4,
    resize: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.4)',
    display: 'block',
    marginTop: 12,
  }

  const isSaint = post.template === 'saint-day' || post.template === 'saint-highlight'
  const bgColor = post.bgColor || (post.template === 'split-quote' ? '#f0d4b8' : '#7a9170')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Background color */}
      <span style={{ ...labelStyle, marginTop: 0 }}>Background Color</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <input
          type="color"
          value={bgColor}
          onChange={e => onUpdate({ bgColor: e.target.value })}
          style={{ width: 32, height: 32, borderRadius: 6, cursor: 'pointer', border: 'none', background: 'transparent' }}
        />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{bgColor}</span>
      </div>

      {/* Content fields */}
      {isSaint ? (
        <>
          <span style={labelStyle}>Saint Name</span>
          <input style={inputStyle} placeholder="e.g. Santa Faustina"
            value={post.saintName || ''} onChange={e => onUpdate({ saintName: e.target.value })} />
          <span style={labelStyle}>Description</span>
          <textarea rows={3} style={inputStyle} placeholder="Short description…"
            value={post.description || ''} onChange={e => onUpdate({ description: e.target.value })} />
          <span style={labelStyle}>Date</span>
          <input style={inputStyle} placeholder="e.g. 22 de Febrero"
            value={post.date || ''} onChange={e => onUpdate({ date: e.target.value })} />
        </>
      ) : (
        <>
          <span style={labelStyle}>Quote</span>
          <textarea rows={3} style={inputStyle} placeholder="Enter quote…"
            value={post.quote || ''} onChange={e => onUpdate({ quote: e.target.value })} />
          <span style={labelStyle}>Author</span>
          <input style={inputStyle} placeholder="— Author Name"
            value={post.author || ''} onChange={e => onUpdate({ author: e.target.value })} />
          <span style={labelStyle}>Date</span>
          <input style={inputStyle} placeholder="e.g. 22 de Febrero"
            value={post.date || ''} onChange={e => onUpdate({ date: e.target.value })} />
        </>
      )}

      {/* Actions */}
      <button
        onClick={onEdit}
        style={{
          width: '100%',
          marginTop: 16,
          padding: '9px 14px',
          borderRadius: 6,
          border: 'none',
          background: '#ffffff',
          color: '#000000',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        Open in Editor →
      </button>
      <button
        onClick={onDuplicate}
        style={{
          width: '100%',
          marginTop: 6,
          padding: '7px 14px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'transparent',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        Duplicate
      </button>
    </div>
  )
}

function UploadTab({ onAdd }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [pendingTemplate, setPendingTemplate] = useState('quote-bg')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const dataUrl = await fileToDataUrl(file)
    setPreview(dataUrl)
  }

  const handleAdd = () => {
    if (!preview) return
    onAdd(preview, pendingTemplate)
    setPreview(null)
    setPendingTemplate('quote-bg')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%', padding: '28px 0', borderRadius: 6, cursor: 'pointer', outline: 'none',
          border: '1px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 500, transition: 'all 0.12s',
        }}
      >
        Click to select an image
      </button>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

      {preview && (
        <>
          <img src={preview} alt="preview" style={{ width: '100%', borderRadius: 4, maxHeight: 140, objectFit: 'cover' }} />
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>Template</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {MAIN_TEMPLATES.map(({ label, switchTo, group }) => {
              const active = group.includes(pendingTemplate)
              return (
                <button key={switchTo} onClick={() => setPendingTemplate(switchTo)} style={{
                  flex: 1, fontSize: 10, fontWeight: 500, padding: '4px 4px', borderRadius: 4,
                  border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)', cursor: 'pointer', outline: 'none',
                }}>
                  {label}
                </button>
              )
            })}
          </div>
          <button onClick={handleAdd} style={{
            width: '100%', padding: '8px', borderRadius: 6, border: 'none',
            background: '#fff', color: '#000', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            + Add to Grid
          </button>
        </>
      )}
    </div>
  )
}

export default function GridView({ posts, onPostsChange, onEditPost, scrollY = 0, onScrollY, previewFormat = '4x5', onPreviewFormatChange, reverseOrder = false, onReverseOrderChange }) {
  const [zipProgress, setZipProgress] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [sidebarTab, setSidebarTab] = useState('wikimedia')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [downloadFormat, setDownloadFormat] = useState('png')
  const [cropFormats, setCropFormats] = useState(['4x5', '9x16'])

  const toggleCropFormat = (key) => {
    setCropFormats(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    )
  }
  const fileInputRef = useRef(null)
  const santoralFileRef = useRef(null)
  const mainRef = useRef(null)

  useEffect(() => {
    if (mainRef.current && scrollY) mainRef.current.scrollTop = scrollY
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showSantoral, setShowSantoral] = useState(false)
  const [santoralUrl, setSantoralUrl] = useState('')
  const [santoralError, setSantoralError] = useState('')
  const [santoralLoading, setSantoralLoading] = useState(false)

  const applySantoral = (posts) => {
    onPostsChange(() => posts)
    setShowSantoral(false)
    setSantoralUrl('')
    setSantoralError('')
  }

  const handleSantoralFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const raw = await file.text()
      applySantoral(parseSantoralJson(raw))
    } catch (err) {
      setSantoralError(`Error al leer el archivo: ${err.message}`)
    }
  }

  const handleSantoralUrl = async () => {
    const url = santoralUrl.trim()
    if (!url) return
    setSantoralLoading(true)
    setSantoralError('')
    try {
      const res = await fetch(toFetchableUrl(url))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.text()
      applySantoral(parseSantoralJson(raw))
    } catch (err) {
      setSantoralError(
        err.message.includes('fetch')
          ? 'No se pudo acceder a la URL. Descarga el archivo y súbelo manualmente.'
          : `Error: ${err.message}`
      )
    } finally {
      setSantoralLoading(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const imported = await importProject(file)
      onPostsChange(() => imported)
    } catch {
      alert('Could not read the file. Make sure it is a valid project JSON.')
    }
  }

  const handleNewProject = () => {
    if (realPosts.length > 0 && !window.confirm('Start a new project? Unsaved changes will be lost.')) return
    onPostsChange(() => [])
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Ensure trailing blank for URL tab
  useEffect(() => {
    const last = posts[posts.length - 1]
    if (!last || last.imageUrl !== '') {
      onPostsChange(p => {
        const l = p[p.length - 1]
        if (!l || l.imageUrl !== '') return [...p, makePost()]
        return p
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length])

  const updatePostUrl = (id, imageUrl) => {
    onPostsChange(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, imageUrl } : p)
      const last = updated[updated.length - 1]
      if (last && last.imageUrl !== '') return [...updated, makePost()]
      return updated
    })
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deletePost = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    onPostsChange(prev => {
      const filtered = prev.filter(p => p.id !== id)
      if (filtered.length === 0 || filtered[filtered.length - 1].imageUrl !== '') {
        return [...filtered, makePost()]
      }
      return filtered
    })
  }

  const updatePost = (id, changes) => {
    onPostsChange(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p))
  }

  const duplicatePost = (id) => {
    onPostsChange(prev => {
      const idx = prev.findIndex(p => p.id === id)
      if (idx === -1) return prev
      const copy = { ...prev[idx], id: uuid(), reviewed: false }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }

  const addBlankAfterLast = () => {
    onPostsChange(prev => {
      const last = prev[prev.length - 1]
      if (last && last.imageUrl === '') return prev
      return [...prev, makePost()]
    })
  }

  // Wikimedia: prepend new post at top with selected template
  const handleUploadAdd = (dataUrl, template) => {
    onPostsChange(prev => {
      const newPost = makePost(dataUrl, template)
      const hasTrailingBlank = prev.length > 0 && prev[prev.length - 1].imageUrl === ''
      if (hasTrailingBlank) return [newPost, ...prev.slice(0, -1), prev[prev.length - 1]]
      return [newPost, ...prev]
    })
  }

  const handleWikimediaAdd = (url, _item, template = 'quote-bg') => {
    onPostsChange(prev => {
      if (prev.some(p => p.imageUrl === url)) return prev
      const newPost = makePost(url, template)
      const hasTrailingBlank = prev.length > 0 && prev[prev.length - 1].imageUrl === ''
      if (hasTrailingBlank) {
        return [newPost, ...prev.slice(0, -1), prev[prev.length - 1]]
      }
      return [newPost, ...prev]
    })
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    onPostsChange(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id)
      const newIndex = prev.findIndex(p => p.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const handleDownload = async (onlySelected = false) => {
    if (!realPosts.length) return
    setZipProgress(0)
    await downloadZip(realPosts, {
      selectedIds: onlySelected ? selectedIds : null,
      format: downloadFormat,
      cropFormats,
      onProgress: setZipProgress,
    })
    setZipProgress(null)
  }

  // A "real" post has an image OR text content — excludes blank URL-tab placeholders
  const realPosts = posts.filter(p => p.imageUrl || p.quote || p.saintName || p.author)
  const displayPosts = reverseOrder ? [...realPosts].reverse() : realPosts
  const reviewed = realPosts.filter(p => p.reviewed).length
  const realPostIds = displayPosts.map(p => p.id)
  const addedUrls = realPosts.map(p => p.imageUrl)

  // Single-select quick-edit: only when exactly 1 item is selected
  const singleSelectedId = selectedIds.size === 1 ? [...selectedIds][0] : null
  const selectedPost = singleSelectedId ? posts.find(p => p.id === singleSelectedId) : null

  const handleEditSelected = () => {
    if (!selectedPost) return
    onEditPost(posts.findIndex(p => p.id === singleSelectedId))
    setSelectedIds(new Set())
  }

  const handleApplyStoryText = (changes) => {
    onPostsChange(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, ...changes } : p))
  }

  const isStoryMode = previewFormat === '9x16' && selectedIds.size > 0
  const storyModeSeed = isStoryMode ? posts.find(p => p.id === [...selectedIds][0]) : null

  return (
    <div className="flex h-screen bg-[#0f0f0f] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-[#141414] border-r border-white/10 flex flex-col">

        {/* Header */}
        <div className="px-4 pt-3.5 pb-3 border-b border-white/10">
          {isStoryMode ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
                Back
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {selectedIds.size} selected
              </span>
            </div>
          ) : selectedPost ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
                Back
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Post {String((realPosts.length) - realPosts.findIndex(p => p.id === singleSelectedId)).padStart(2, '0')}
              </span>
            </div>
          ) : (
            <>
              <h1 className="text-[11px] font-semibold tracking-widest uppercase text-white/40 mb-3">
                Post Generator
              </h1>
              <div className="flex gap-1.5">
                {[
                  { key: 'wikimedia', label: 'Wikimedia' },
                  { key: 'upload', label: 'Upload' },
                  { key: 'urls', label: 'URLs' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setSidebarTab(tab.key)}
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '5px 8px',
                      borderRadius: 20,
                      border: sidebarTab === tab.key ? 'none' : '1px solid rgba(255,255,255,0.12)',
                      background: sidebarTab === tab.key ? '#ffffff' : 'transparent',
                      color: sidebarTab === tab.key ? '#000000' : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tab / selected post content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isStoryMode ? (
            <StoryTextPanel
              key={[...selectedIds].sort().join(',')}
              selectedCount={selectedIds.size}
              seed={storyModeSeed}
              onApply={handleApplyStoryText}
            />
          ) : selectedPost ? (
            <PostQuickPanel
              post={selectedPost}
              onUpdate={(changes) => updatePost(singleSelectedId, changes)}
              onEdit={handleEditSelected}
              onDuplicate={() => { duplicatePost(singleSelectedId); setSelectedIds(new Set()) }}
            />
          ) : sidebarTab === 'wikimedia' ? (
            <WikimediaSearch
              addedUrls={addedUrls}
              onSelect={handleWikimediaAdd}
            />
          ) : sidebarTab === 'upload' ? (
            <UploadTab onAdd={handleUploadAdd} />
          ) : (
            <div className="flex flex-col gap-2">
              {posts.map((post, i) => (
                <UrlRow
                  key={post.id}
                  post={post}
                  index={i}
                  isLast={i === posts.length - 1}
                  onChange={url => updatePostUrl(post.id, url)}
                  onDelete={() => deletePost(post.id)}
                  onEnterPressed={addBlankAfterLast}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats + actions */}
        <div className="px-4 py-4 border-t border-white/10 flex flex-col gap-3">
          {/* Santoral loader */}
          <button
            onClick={() => { setShowSantoral(true); setSantoralError('') }}
            style={{
              width: '100%', fontSize: 11, fontWeight: 600, padding: '8px 0',
              borderRadius: 6, border: '1px solid rgba(180,100,60,0.4)',
              background: 'rgba(139,58,42,0.15)', color: 'rgba(210,150,120,0.9)',
              cursor: 'pointer', outline: 'none', transition: 'all 0.15s',
              letterSpacing: '0.02em',
            }}
          >
            Cargar Santoral (JSON)
          </button>

          {/* Project actions */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={handleNewProject}
              style={{
                flex: 1, fontSize: 10, fontWeight: 600, padding: '5px 0',
                borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.45)',
                cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
              }}
            >
              New
            </button>
            <button
              onClick={() => exportProject(posts)}
              style={{
                flex: 1, fontSize: 10, fontWeight: 600, padding: '5px 0',
                borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.45)',
                cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
              }}
            >
              Save
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1, fontSize: 10, fontWeight: 600, padding: '5px 0',
                borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.45)',
                cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
              }}
            >
              Open
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
          {realPosts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] text-white/40">
                <span>
                  {realPosts.length} posts · {reviewed} reviewed
                  {selectedIds.size > 0 && (
                    <> · <span className="text-white/60">{selectedIds.size} selected</span></>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-emerald-400">
                    {realPosts.length ? Math.round(reviewed / realPosts.length * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all rounded-full"
                  style={{ width: `${realPosts.length ? (reviewed / realPosts.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* Format + crop toggles */}
          {realPosts.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 4 }}>
                {['jpg', 'png'].map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setDownloadFormat(fmt)}
                    style={{
                      flex: 1, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      padding: '4px 0', borderRadius: 4,
                      border: downloadFormat === fmt ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      background: downloadFormat === fmt ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: downloadFormat === fmt ? '#fff' : 'rgba(255,255,255,0.35)',
                      cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
                    }}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ key: '1x1', label: '1:1' }, { key: '4x5', label: '4:5' }, { key: '9x16', label: '9:16' }].map(({ key, label }) => {
                  const active = cropFormats.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleCropFormat(key)}
                      style={{
                        flex: 1, fontSize: 10, fontWeight: 600,
                        padding: '4px 0', borderRadius: 4,
                        border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: active ? '#fff' : 'rgba(255,255,255,0.35)',
                        cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Download Selected */}
          {selectedIds.size > 0 && (
            <button
              onClick={() => handleDownload(true)}
              disabled={zipProgress !== null}
              style={{
                width: '100%',
                background: 'transparent',
                color: 'rgba(255,255,255,0.45)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                padding: '7px 14px',
                cursor: zipProgress !== null ? 'default' : 'pointer',
                opacity: zipProgress !== null ? 0.35 : 1,
                transition: 'all 0.15s',
              }}
            >
              {zipProgress !== null ? `Generating… ${zipProgress}%` : `⬇ Download Selected (${selectedIds.size})`}
            </button>
          )}

          {/* Download All */}
          <button
            onClick={() => handleDownload(false)}
            disabled={zipProgress !== null || !realPosts.length}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              padding: '8px 14px',
              cursor: realPosts.length && zipProgress === null ? 'pointer' : 'default',
              opacity: realPosts.length && zipProgress === null ? 1 : 0.35,
              transition: 'all 0.15s',
              width: '100%',
            }}
          >
            {zipProgress !== null && selectedIds.size === 0 ? `Generating… ${zipProgress}%` : '⬇ Download All (ZIP)'}
          </button>
        </div>
      </aside>

      {/* Grid */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto"
        onScroll={e => onScrollY?.(e.currentTarget.scrollTop)}
        onClick={() => setSelectedIds(new Set())}
      >
        {realPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/15">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <p className="text-xs">Search Wikimedia or paste URLs to get started</p>
          </div>
        ) : (
          <div className="min-h-full flex flex-col items-center p-8 gap-4" onClick={e => e.stopPropagation()}>
            {/* Toolbar row: select-all left, preview+order right */}
            <div className="flex items-center justify-between self-stretch" onClick={e => e.stopPropagation()}>
              {/* Select / deselect all */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set(realPostIds))}
                  style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                    color: 'rgba(255,255,255,0.35)', cursor: 'pointer', outline: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  Select all
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    style={{
                      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 20,
                      border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                      color: 'rgba(255,255,255,0.35)', cursor: 'pointer', outline: 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    Deselect all
                  </button>
                )}
              </div>

              {/* Preview format toggle + order toggle */}
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
              {/* Order toggle */}
              <button
                onClick={() => onReverseOrderChange?.(!reverseOrder)}
                title={reverseOrder ? 'Newest first' : 'Newest last'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 10px',
                  borderRadius: 20,
                  border: reverseOrder ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
                  background: reverseOrder ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: reverseOrder ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {reverseOrder
                    ? <><path d="M2 7.5h6M2 5h4M2 2.5h2"/></>
                    : <><path d="M2 2.5h6M2 5h4M2 7.5h2"/></>
                  }
                </svg>
                {reverseOrder ? 'Newest last' : 'Newest first'}
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />

              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Preview</span>
              {[{ key: '4x5', label: '4:5' }, { key: '9x16', label: '9:16' }].map(({ key, label }) => {
                const active = previewFormat === key
                return (
                  <button
                    key={key}
                    onClick={() => onPreviewFormatChange?.(key)}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '3px 10px',
                      borderRadius: 20,
                      border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
                      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              </div>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={({ active }) => setActiveId(active.id)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={realPostIds} strategy={rectSortingStrategy}>
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${previewFormat === '9x16' ? 7 : 3}, ${previewFormat === '9x16' ? 169 : 240}px)`,
                    width: 'fit-content',
                  }}
                >
                  {displayPosts.map((post, i) => (
                    <GridCell
                      key={post.id}
                      post={post}
                      index={i}
                      total={displayPosts.length}
                      isSelected={selectedIds.has(post.id)}
                      onSelect={() => toggleSelect(post.id)}
                      onEdit={() => onEditPost(posts.findIndex(p => p.id === post.id))}
                      onRemove={() => deletePost(post.id)}
                      onDuplicate={() => duplicatePost(post.id)}
                      previewFormat={previewFormat}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </main>

      <style>{`
        .action-btn { background:white; color:black; border:none; border-radius:6px; font-size:11px; font-weight:600; padding:8px 14px; cursor:pointer; transition:opacity .15s; }
        .action-btn:hover { opacity:.85; }
        .action-btn:disabled { opacity:.35; cursor:default; }
      `}</style>

      {/* Santoral modal */}
      {showSantoral && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowSantoral(false)}
        >
          <div
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 28, width: 420, maxWidth: '92vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>Cargar Santoral</h2>
              <button onClick={() => setShowSantoral(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '0 0 22px', lineHeight: 1.5 }}>
              Posts sin quote → plantilla <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Circle</strong> con colores terracota.<br/>
              Posts con quote → <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Full BG</strong> o <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Split</strong> aleatorio.<br/>
              Orden: fechas recientes arriba, primeras abajo.
            </p>

            {/* File upload */}
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
              Subir archivo
            </label>
            <button
              onClick={() => santoralFileRef.current?.click()}
              style={{
                width: '100%', padding: '10px', borderRadius: 6, cursor: 'pointer', outline: 'none',
                border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 500, transition: 'all 0.12s',
              }}
            >
              Seleccionar archivo .json
            </button>
            <input ref={santoralFileRef} type="file" accept=".json,.txt" style={{ display: 'none' }} onChange={handleSantoralFile} />

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>o</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* URL */}
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
              Desde URL (Google Docs / JSON directo)
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="https://docs.google.com/document/d/…"
                value={santoralUrl}
                onChange={e => setSantoralUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSantoralUrl()}
                style={{
                  flex: 1, background: '#242424', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, color: '#f0f0f0', fontSize: 12, padding: '8px 10px', outline: 'none',
                }}
              />
              <button
                onClick={handleSantoralUrl}
                disabled={santoralLoading || !santoralUrl.trim()}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none', outline: 'none',
                  background: santoralUrl.trim() ? '#fff' : 'rgba(255,255,255,0.1)',
                  color: santoralUrl.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                  fontSize: 11, fontWeight: 600, cursor: santoralUrl.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap', transition: 'all 0.12s',
                }}
              >
                {santoralLoading ? '…' : 'Cargar'}
              </button>
            </div>

            {santoralError && (
              <p style={{ color: '#f87171', fontSize: 11, margin: '12px 0 0', lineHeight: 1.5 }}>{santoralError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef } from 'react'
import FontPicker from './FontPicker'
import WikimediaSearch from './WikimediaSearch'
import { fileToDataUrl } from '../utils/storage'

const MAIN_TEMPLATES = [
  { label: 'Full BG',  group: ['quote-bg', 'saint-highlight'], switchTo: 'quote-bg' },
  { label: 'Split',    group: ['split-quote'],                  switchTo: 'split-quote' },
  { label: 'Circle',   group: ['saint-day'],                    switchTo: 'saint-day' },
]

const SIZE_SCOPES = [
  { label: 'All', key: 'all' },
  { label: '1:1', key: '1x1' },
  { label: '4:5', key: '4x5' },
  { label: '9:16', key: '9x16' },
]

export default function ControlPanel({ post, onChange }) {
  const set = (key) => (e) => onChange({ ...post, [key]: e.target.value })
  const template = post.template || 'quote-bg'

  const [imageTab, setImageTab] = useState('wikimedia')
  const uploadRef = useRef(null)
  const [sizeScope, setSizeScope] = useState('all')
  const [splitScope, setSplitScope] = useState('all')

  const effectiveQuoteSize = sizeScope === 'all'
    ? post.quoteSize
    : (post.quoteSizes?.[sizeScope] ?? post.quoteSize)

  const effectiveAuthorSize = sizeScope === 'all'
    ? post.authorSize
    : (post.authorSizes?.[sizeScope] ?? post.authorSize)

  const hasQuoteOverride = sizeScope !== 'all' && post.quoteSizes?.[sizeScope] !== undefined
  const hasAuthorOverride = sizeScope !== 'all' && post.authorSizes?.[sizeScope] !== undefined

  const handleQuoteSizeChange = (value) => {
    if (sizeScope === 'all') onChange({ ...post, quoteSize: value })
    else onChange({ ...post, quoteSizes: { ...(post.quoteSizes || {}), [sizeScope]: Number(value) } })
  }

  const handleAuthorSizeChange = (value) => {
    if (sizeScope === 'all') onChange({ ...post, authorSize: value })
    else onChange({ ...post, authorSizes: { ...(post.authorSizes || {}), [sizeScope]: Number(value) } })
  }

  const effectiveSplitDir = splitScope === 'all'
    ? (post.splitDirection || 'vertical')
    : (post.splitDirections?.[splitScope] ?? post.splitDirection ?? 'vertical')

  const effectiveImgPos = splitScope === 'all'
    ? (post.imagePosition || 'left')
    : (post.imagePositions?.[splitScope] ?? post.imagePosition ?? 'left')

  const handleSplitDirChange = (dir) => {
    const compatPos = dir === 'horizontal'
      ? (effectiveImgPos === 'left' || effectiveImgPos === 'right' ? 'top' : effectiveImgPos)
      : (effectiveImgPos === 'top' || effectiveImgPos === 'bottom' ? 'left' : effectiveImgPos)
    if (splitScope === 'all') {
      onChange({ ...post, splitDirection: dir, imagePosition: compatPos })
    } else {
      onChange({
        ...post,
        splitDirections: { ...(post.splitDirections || {}), [splitScope]: dir },
        imagePositions: { ...(post.imagePositions || {}), [splitScope]: compatPos },
      })
    }
  }

  const handleImgPosChange = (pos) => {
    if (splitScope === 'all') {
      onChange({ ...post, imagePosition: pos })
    } else {
      onChange({ ...post, imagePositions: { ...(post.imagePositions || {}), [splitScope]: pos } })
    }
  }

  const resetSplitOverride = () => {
    if (splitScope === 'all') return
    const nextDirs = { ...(post.splitDirections || {}) }; delete nextDirs[splitScope]
    const nextPos  = { ...(post.imagePositions  || {}) }; delete nextPos[splitScope]
    onChange({ ...post, splitDirections: nextDirs, imagePositions: nextPos })
  }

  const resetSizeOverride = (field) => {
    if (sizeScope === 'all') return
    if (field === 'quote') {
      const next = { ...(post.quoteSizes || {}) }; delete next[sizeScope]
      onChange({ ...post, quoteSizes: next })
    } else {
      const next = { ...(post.authorSizes || {}) }; delete next[sizeScope]
      onChange({ ...post, authorSizes: next })
    }
  }

  return (
    <aside className="w-72 shrink-0 bg-[#141414] border-r border-white/10 flex flex-col overflow-y-auto">
      <div className="px-5 py-4 border-b border-white/10">
        <h1 className="text-sm font-semibold tracking-widest uppercase text-white/40">Post Settings</h1>
      </div>

      <div className="flex flex-col gap-6 p-5">

        {/* Template selector */}
        <section>
          <label className="section-label">Template</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {MAIN_TEMPLATES.map(({ label, group, switchTo }) => {
              const active = group.includes(template)
              return (
                <button
                  key={switchTo}
                  onClick={() => {
                    if (active) return
                    const from = template
                    const to   = switchTo
                    const isSaintFrom = from === 'saint-day'
                    const isSaintTo   = to   === 'saint-day'
                    const styleDefaults =
                      to === 'split-quote' ? { bgColor: '#f0d4b8', textColor: '#4a3025' } :
                      to === 'saint-day'   ? { bgColor: post.bgColor || '#7a9170', textColor: '#ffffff' } :
                      { textColor: '#ffffff' }
                    const content =
                      isSaintFrom && !isSaintTo
                        ? { quote: post.quote || post.description || '', author: post.saintName || post.author || '' }
                        : !isSaintFrom && isSaintTo
                        ? { description: post.description || post.quote || '', saintName: post.saintName || post.author || '' }
                        : {}
                    onChange({ ...post, template: to, ...styleDefaults, ...content })
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: active ? 'default' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: 'left',
                    outline: 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Full BG sub-layout toggle */}
          {(template === 'quote-bg' || template === 'saint-highlight') && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[{ id: 'quote-bg', label: 'Quote' }, { id: 'saint-highlight', label: 'SD Highlight' }].map(sub => {
                const active = template === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      if (active) return
                      const content = sub.id === 'quote-bg'
                        ? { quote: post.description || post.quote || '', author: post.saintName || post.author || '' }
                        : { description: post.quote || post.description || '', saintName: post.author || post.saintName || '' }
                      onChange({ ...post, template: sub.id, ...content })
                    }}
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '5px 8px',
                      borderRadius: 20,
                      border: active ? 'none' : '1px solid rgba(255,255,255,0.15)',
                      background: active ? '#ffffff' : 'transparent',
                      color: active ? '#000000' : 'rgba(255,255,255,0.4)',
                      cursor: active ? 'default' : 'pointer',
                      outline: 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {sub.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Split layout controls — inline under template, same pattern as Full BG sub-toggle */}
          {template === 'split-quote' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Scope selector */}
              <div style={{ display: 'flex', gap: 3 }}>
                {SIZE_SCOPES.map(scope => {
                  const active = splitScope === scope.key
                  const hasOverride = scope.key !== 'all' && (
                    post.splitDirections?.[scope.key] !== undefined ||
                    post.imagePositions?.[scope.key] !== undefined
                  )
                  return (
                    <button key={scope.key} onClick={() => setSplitScope(scope.key)} style={{
                      flex: 1, fontSize: 10, fontWeight: 600, padding: '3px 4px', borderRadius: 4,
                      border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer', outline: 'none', position: 'relative', transition: 'all 0.12s',
                    }}>
                      {scope.label}
                      {hasOverride && <span style={{ position: 'absolute', top: 2, right: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />}
                    </button>
                  )
                })}
                {splitScope !== 'all' && (post.splitDirections?.[splitScope] !== undefined || post.imagePositions?.[splitScope] !== undefined) && (
                  <button onClick={resetSplitOverride} style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>↺</button>
                )}
              </div>
              {/* Direction + Position in one row */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ id: 'vertical', label: '↔ Vert' }, { id: 'horizontal', label: '↕ Horiz' }].map(opt => {
                  const active = effectiveSplitDir === opt.id
                  return (
                    <button key={opt.id} onClick={() => handleSplitDirChange(opt.id)}
                      className={`flex-1 text-xs py-1.5 rounded border transition-all
                        ${active ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:border-white/40'}`}>
                      {opt.label}
                    </button>
                  )
                })}
                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />
                {(effectiveSplitDir === 'horizontal' ? ['top', 'bottom'] : ['left', 'right']).map(pos => (
                  <button key={pos} onClick={() => handleImgPosChange(pos)}
                    className={`flex-1 text-xs py-1.5 rounded border transition-all capitalize
                      ${effectiveImgPos === pos ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:border-white/40'}`}>
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Image */}
        <section>
          <label className="section-label">Background Image</label>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, marginBottom: 8 }}>
            {[{ key: 'wikimedia', label: 'Wikimedia' }, { key: 'upload', label: 'Upload' }, { key: 'url', label: 'URL' }].map(tab => (
              <button
                key={tab.key}
                onClick={() => setImageTab(tab.key)}
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '4px 8px',
                  borderRadius: 20,
                  border: imageTab === tab.key ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  background: imageTab === tab.key ? '#ffffff' : 'transparent',
                  color: imageTab === tab.key ? '#000000' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {imageTab === 'wikimedia' ? (
            <WikimediaSearch
              currentUrl={post.imageUrl}
              onSelect={(url) => onChange({ ...post, imageUrl: url })}
            />
          ) : imageTab === 'upload' ? (
            <>
              <button
                onClick={() => uploadRef.current?.click()}
                style={{
                  width: '100%', padding: '24px 0', borderRadius: 6, cursor: 'pointer', outline: 'none',
                  border: '1px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 500,
                }}
              >
                {post.imageUrl?.startsWith('data:') ? '✓ Image uploaded — click to replace' : 'Click to upload an image'}
              </button>
              <input
                ref={uploadRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  e.target.value = ''
                  const dataUrl = await fileToDataUrl(file)
                  onChange({ ...post, imageUrl: dataUrl })
                }}
              />
              {post.imageUrl?.startsWith('data:') && (
                <p className="text-[11px] text-white/30 mt-1">Local image — saved in project file.</p>
              )}
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Paste or type a URL…"
                value={post.imageUrl}
                onChange={set('imageUrl')}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text').trim()
                  if (pasted) { e.preventDefault(); onChange({ ...post, imageUrl: pasted }) }
                }}
                className="input w-full"
              />
              <p className="text-[11px] text-white/30 mt-1">Drag the image inside each canvas to reframe</p>
            </>
          )}
        </section>

        {/* Template-specific content fields */}
        {(template === 'saint-day' || template === 'saint-highlight') ? (
          <>
            <section>
              <label className="section-label">Saint Name</label>
              <input
                type="text"
                placeholder="e.g. Santa Faustina"
                value={post.saintName || ''}
                onChange={e => onChange({ ...post, saintName: e.target.value })}
                className="input w-full mt-1"
              />
            </section>
            <section>
              <label className="section-label">Description</label>
              <textarea
                rows={3}
                placeholder="Short description…"
                value={post.description || ''}
                onChange={e => onChange({ ...post, description: e.target.value })}
                className="input w-full mt-1 resize-none"
              />
            </section>
            <section>
              <label className="section-label">Date</label>
              <input
                type="text"
                placeholder="e.g. 22 de Febrero"
                value={post.date || ''}
                onChange={e => onChange({ ...post, date: e.target.value })}
                className="input w-full mt-1"
              />
            </section>
            {template === 'saint-day' && (
              <section>
                <label className="section-label">Background Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={post.bgColor || '#7a9170'} onChange={set('bgColor')}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                  <span className="text-xs text-white/50">{post.bgColor || '#7a9170'}</span>
                </div>
              </section>
            )}
          </>
        ) : template === 'split-quote' ? (
          <>
            <section>
              <label className="section-label">Quote</label>
              <textarea rows={4} placeholder="Enter your quote…" value={post.quote}
                onChange={set('quote')} className="input w-full mt-1 resize-none" />
              <label className="section-label mt-3 block">Author</label>
              <input type="text" placeholder="— Author Name" value={post.author}
                onChange={set('author')} className="input w-full mt-1" />
            </section>
            <section>
              <label className="section-label">Panel Background</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={post.bgColor || '#f0d4b8'} onChange={set('bgColor')}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-xs text-white/50">{post.bgColor || '#f0d4b8'}</span>
              </div>
            </section>
          </>
        ) : (
          <section>
            <label className="section-label">Quote</label>
            <textarea rows={4} placeholder="Enter your quote…" value={post.quote}
              onChange={set('quote')} className="input w-full mt-1 resize-none" />
            <label className="section-label mt-3 block">Author</label>
            <input type="text" placeholder="— Author Name" value={post.author}
              onChange={set('author')} className="input w-full mt-1" />
            <label className="section-label mt-3 block">Date</label>
            <input type="text" placeholder="e.g. 22 de Febrero" value={post.date || ''}
              onChange={e => onChange({ ...post, date: e.target.value })} className="input w-full mt-1" />
          </section>
        )}

        {/* Fonts */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="section-label" style={{ margin: 0 }}>Font</label>
            <button
              onClick={() => onChange({
                ...post,
                quoteFont: 'Aleo',
                authorFont: 'Aleo',
                quoteSize: 24,
                authorSize: 20,
                quoteSizes: {},
                authorSizes: {},
              })}
              style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              Reset to default
            </button>
          </div>
          <div className="mt-2">
            <FontPicker
              quoteFont={post.quoteFont}
              authorFont={post.authorFont}
              onChange={({ quoteFont, authorFont }) => onChange({ ...post, quoteFont, authorFont })}
            />
          </div>
        </section>

        {/* Sizes */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label className="section-label" style={{ margin: 0 }}>Font Sizes</label>
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
            {SIZE_SCOPES.map(scope => {
              const active = sizeScope === scope.key
              const hasOverride = scope.key !== 'all' && (
                post.quoteSizes?.[scope.key] !== undefined ||
                post.authorSizes?.[scope.key] !== undefined
              )
              return (
                <button
                  key={scope.key}
                  onClick={() => setSizeScope(scope.key)}
                  style={{
                    flex: 1, fontSize: 10, fontWeight: 600, padding: '3px 4px', borderRadius: 4,
                    border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', outline: 'none', position: 'relative', transition: 'all 0.12s',
                  }}
                >
                  {scope.label}
                  {hasOverride && (
                    <span style={{ position: 'absolute', top: 2, right: 3, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
                  )}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="section-label" style={{ margin: 0 }}>
              {(template === 'saint-day' || template === 'saint-highlight') ? 'Name Size' : 'Quote Size'} <span className="text-white/40">{effectiveQuoteSize}px</span>
            </label>
            {hasQuoteOverride && (
              <button onClick={() => resetSizeOverride('quote')} style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>reset</button>
            )}
          </div>
          <input type="range" min={14} max={72} value={effectiveQuoteSize}
            onChange={e => handleQuoteSizeChange(e.target.value)} className="w-full mt-1 accent-white" />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <label className="section-label" style={{ margin: 0 }}>
              {(template === 'saint-day' || template === 'saint-highlight') ? 'Description Size' : 'Author Size'} <span className="text-white/40">{effectiveAuthorSize}px</span>
            </label>
            {hasAuthorOverride && (
              <button onClick={() => resetSizeOverride('author')} style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>reset</button>
            )}
          </div>
          <input type="range" min={10} max={36} value={effectiveAuthorSize}
            onChange={e => handleAuthorSizeChange(e.target.value)} className="w-full mt-1 accent-white" />
        </section>

        {/* Text color */}
        <section>
          <label className="section-label">Text Color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={post.textColor} onChange={set('textColor')}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
            <span className="text-xs text-white/50">{post.textColor}</span>
          </div>
        </section>

        {/* Date style */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="section-label" style={{ margin: 0 }}>Date Color</label>
            {post.dateColor && (
              <button onClick={() => onChange({ ...post, dateColor: '' })}
                style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={post.dateColor || post.textColor || '#ffffff'} onChange={e => onChange({ ...post, dateColor: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
            <span className="text-xs text-white/50">{post.dateColor || '(follows text color)'}</span>
          </div>
          <label className="section-label mt-3 block">Date Weight</label>
          <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
            {['300', '400', '500', '700'].map(w => {
              const active = (post.dateWeight || '400') === w
              return (
                <button key={w} onClick={() => onChange({ ...post, dateWeight: w })}
                  style={{
                    flex: 1, fontSize: 10, fontWeight: Number(w), padding: '4px 2px', borderRadius: 4,
                    border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
                  }}>{w}</button>
              )
            })}
          </div>
        </section>

        {/* Overlay — for image-based templates */}
        {(template === 'quote-bg' || template === 'saint-highlight') && (
          <section>
            <label className="section-label">Overlay Color</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={post.overlayColor} onChange={set('overlayColor')}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
              <span className="text-xs text-white/50">{post.overlayColor}</span>
            </div>
            <label className="section-label mt-3 block">
              Opacity <span className="text-white/40">{Math.round(post.overlayOpacity * 100)}%</span>
            </label>
            <input type="range" min={0} max={1} step={0.01} value={post.overlayOpacity}
              onChange={set('overlayOpacity')} className="w-full mt-1 accent-white" />
          </section>
        )}

        {/* Content / Text position — not applicable to split-quote (always centered) */}
        {template !== 'split-quote' && <section>
          <label className="section-label">
            {(template === 'saint-day' || template === 'saint-highlight') ? 'Content Position' : 'Text Position'}
          </label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {['top', 'middle', 'bottom'].map(pos => (
              <button key={pos} onClick={() => onChange({ ...post, textPosition: pos })}
                className={`text-xs py-1.5 rounded border transition-all capitalize
                  ${post.textPosition === pos
                    ? 'bg-white text-black border-white'
                    : 'border-white/20 text-white/50 hover:border-white/40'}`}>
                {pos}
              </button>
            ))}
          </div>
        </section>}

        {/* Reviewed */}
        <section>
          <label className="section-label">Status</label>
          <button
            onClick={() => onChange({ ...post, reviewed: !post.reviewed })}
            className={`mt-1 w-full py-2 rounded border text-xs font-semibold transition-all ${
              post.reviewed
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'border-white/15 text-white/40 hover:border-white/30'
            }`}
          >
            {post.reviewed ? '✓ Reviewed' : 'Mark as Reviewed'}
          </button>
        </section>

      </div>

      <style>{`
        .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); }
        .input { background: #1e1e1e; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #f0f0f0; font-size: 13px; padding: 7px 10px; outline: none; transition: border-color .15s; }
        .input:focus { border-color: rgba(255,255,255,0.35); }
        .input option { background: #1e1e1e; }
      `}</style>
    </aside>
  )
}

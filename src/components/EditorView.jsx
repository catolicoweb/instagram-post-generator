import { useRef, useState } from 'react'
import ControlPanel from './ControlPanel'
import FormatCanvas from './FormatCanvas'

const FORMATS = [
  { label: '1:1 Feed',   key: '1x1', w: 400, h: 400 },
  { label: '4:5 Feed',   key: '4x5', w: 360, h: 450 },
  { label: '9:16 Story', key: '9x16', w: 253, h: 450 },
]

export default function EditorView({ posts, currentIndex, onPostChange, onNavigate, onBackToGrid }) {
  const post = posts[currentIndex]
  const exportRefs = useRef({})
  FORMATS.forEach(({ key }) => { if (!exportRefs.current[key]) exportRefs.current[key] = { current: null } })

  const [enabledFormats, setEnabledFormats] = useState({ '1x1': false, '4x5': true, '9x16': true })

  const toggleFormat = (key) => {
    const next = { ...enabledFormats, [key]: !enabledFormats[key] }
    if (Object.values(next).every(v => !v)) return // keep at least one enabled
    setEnabledFormats(next)
  }

  const handleCropChange = (formatKey, newCrop) => {
    onPostChange({ ...post, cropPos: { ...post.cropPos, [formatKey]: newCrop } })
  }

  const activeFormats = FORMATS.filter(f => enabledFormats[f.key])

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-white overflow-hidden">
      <ControlPanel post={post} onChange={onPostChange} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 shrink-0">
          <button
            onClick={onBackToGrid}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
            </svg>
            Back to Grid
          </button>

          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate(currentIndex - 1)} disabled={currentIndex === 0} className="nav-btn">← Prev</button>
            <span className="text-xs text-white/40 tabular-nums">{currentIndex + 1} / {posts.length}</span>
            <button onClick={() => onNavigate(currentIndex + 1)} disabled={currentIndex === posts.length - 1} className="nav-btn">Next →</button>
          </div>

          {/* Format toggles */}
          <div className="flex items-center gap-1.5">
            {FORMATS.map(({ label, key }) => {
              const on = enabledFormats[key]
              return (
                <button
                  key={key}
                  onClick={() => toggleFormat(key)}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '3px 10px',
                    borderRadius: 20,
                    border: on ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
                    background: on ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: on ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
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

        {/* Canvases */}
        <main className="flex-1 overflow-auto p-8">
          <div className="flex flex-wrap gap-10 items-start justify-center min-h-full">
            {activeFormats.map(({ label, key, w, h }) => (
              <div key={key} className="flex flex-col items-center gap-3">
                <FormatCanvas
                  label={label}
                  width={w}
                  height={h}
                  post={post}
                  formatKey={key}
                  cropPos={post.cropPos?.[key]}
                  onCropChange={handleCropChange}
                  exportRef={exportRefs.current[key]}
                />
                <div className="flex gap-2">
                  <button onClick={() => exportRefs.current[key].current?.exportPNG()} className="export-btn">↓ PNG</button>
                  <button onClick={() => exportRefs.current[key].current?.exportJPG()} className="export-btn">↓ JPG</button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <style>{`
        .export-btn { font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; padding:6px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.6); background:transparent; cursor:pointer; transition:all .15s; }
        .export-btn:hover { border-color:rgba(255,255,255,0.5); color:#fff; background:rgba(255,255,255,0.05); }
        .nav-btn { font-size:12px; font-weight:500; padding:5px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.6); background:transparent; cursor:pointer; transition:all .15s; }
        .nav-btn:hover:not(:disabled) { border-color:rgba(255,255,255,0.4); color:#fff; }
        .nav-btn:disabled { opacity:0.25; cursor:default; }
      `}</style>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { ensureFont, ensureFonts } from '../utils/fonts'

const CATEGORIES = [
  {
    name: 'Serif',
    subs: [
      { name: 'Transitional', fonts: ['Playfair Display','Libre Baskerville','Lora','Merriweather','Source Serif 4','Roboto Serif'] },
      { name: 'Old Style',    fonts: ['EB Garamond','Crimson Text','Cormorant Garamond','GFS Didot','Gentium Plus'] },
      { name: 'Modern',       fonts: ['DM Serif Display','Bodoni Moda','Spectral','Italiana'] },
      { name: 'Slab',         fonts: ['Aleo','Roboto Slab','Zilla Slab','Crete Round','Arvo','Noticia Text'] },
      { name: 'Humanist',     fonts: ['Bitter','Domine','Tinos','Noto Serif'] },
      { name: 'Didone',       fonts: ['Libre Bodoni','GFS Didot','Yeseva One'] },
    ],
  },
  {
    name: 'Sans Serif',
    subs: [
      { name: 'Geometric',     fonts: ['Montserrat','Poppins','Josefin Sans','Raleway','Nunito Sans'] },
      { name: 'Humanist',      fonts: ['Inter','Cabin','Muli','Fira Sans','Oxygen'] },
      { name: 'Neo Grotesque', fonts: ['Roboto','Open Sans','Lato','Source Sans 3','Noto Sans'] },
      { name: 'Rounded',       fonts: ['Nunito','Varela Round','Comfortaa','Quicksand'] },
      { name: 'Grotesque',     fonts: ['Barlow','DM Sans','Outfit','Manrope','Plus Jakarta Sans'] },
    ],
  },
  {
    name: 'Display',
    subs: [
      { name: 'Decorative', fonts: ['Abril Fatface','Righteous','Boogaloo','Lilita One','Titan One'] },
      { name: 'Retro',      fonts: ['Lobster','Pacifico','Fredoka One','Bangers','Permanent Marker'] },
      { name: 'Elegant',    fonts: ['Cormorant','Cinzel','Philosopher','Tenor Sans'] },
    ],
  },
  {
    name: 'Handwriting',
    subs: [
      { name: 'Formal',   fonts: ['Great Vibes','Pinyon Script','Alex Brush','Allura','Petit Formal Script'] },
      { name: 'Informal', fonts: ['Caveat','Indie Flower','Patrick Hand','Kalam','Shadows Into Light'] },
      { name: 'Upright',  fonts: ['Architects Daughter','Gochi Hand','Amatic SC','Satisfy'] },
    ],
  },
  {
    name: 'Monospace',
    subs: [
      { name: 'All', fonts: ['Roboto Mono','Source Code Pro','JetBrains Mono','Inconsolata','Space Mono','Fira Code'] },
    ],
  },
]

function loadFontsForSub(sub) {
  sub.fonts.forEach(font => ensureFont(font))
}

export default function FontPicker({ quoteFont, authorFont, onChange }) {
  const [activeField, setActiveField] = useState('quote') // 'quote' | 'author'
  const [openCategory, setOpenCategory] = useState(null)  // category name or null
  const [openSub, setOpenSub] = useState(null)            // sub name or null

  const [, forceUpdate] = useState(0)
  const currentFont = activeField === 'quote' ? quoteFont : authorFont

  // Pre-load current fonts and re-render once ready
  useEffect(() => {
    let cancelled = false
    ensureFonts([quoteFont, authorFont])
      .then(() => { if (!cancelled) forceUpdate(n => n + 1) })
    return () => { cancelled = true }
  }, [quoteFont, authorFont])

  async function handleCategoryClick(catName) {
    if (openCategory === catName) {
      setOpenCategory(null)
      setOpenSub(null)
      return
    }
    const cat = CATEGORIES.find(c => c.name === catName)
    const firstSub = cat?.subs[0]
    setOpenCategory(catName)
    setOpenSub(firstSub?.name ?? null)
    if (firstSub) {
      loadFontsForSub(firstSub)
      const firstFont = firstSub.fonts[0]
      if (firstFont) {
        if (activeField === 'quote') onChange({ quoteFont: firstFont, authorFont })
        else onChange({ quoteFont, authorFont: firstFont })
        await ensureFont(firstFont)
        forceUpdate(n => n + 1)
      }
    }
  }

  async function handleSubClick(sub) {
    if (openSub === sub.name) { setOpenSub(null); return }
    setOpenSub(sub.name)
    loadFontsForSub(sub)
    const firstFont = sub.fonts[0]
    if (firstFont) {
      if (activeField === 'quote') onChange({ quoteFont: firstFont, authorFont })
      else onChange({ quoteFont, authorFont: firstFont })
      await ensureFont(firstFont)
      forceUpdate(n => n + 1)
    }
  }

  async function handleFontSelect(font) {
    // Apply immediately so the canvas updates
    if (activeField === 'quote') onChange({ quoteFont: font, authorFont })
    else onChange({ quoteFont, authorFont: font })
    // Wait for font bytes, then re-render the preview
    await ensureFont(font)
    forceUpdate(n => n + 1)
  }

  function handleFieldToggle(field) {
    setActiveField(field)
    setOpenCategory(null)
    setOpenSub(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Field toggle pills */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['quote', 'author'].map((field) => {
          const active = activeField === field
          return (
            <button
              key={field}
              onClick={() => handleFieldToggle(field)}
              style={{
                flex: 1,
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'capitalize',
                padding: '5px 8px',
                borderRadius: 20,
                border: active ? 'none' : '1px solid rgba(255,255,255,0.15)',
                background: active ? '#ffffff' : 'transparent',
                color: active ? '#000000' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                outline: 'none',
              }}
            >
              {field === 'quote' ? 'Quote Font' : 'Author Font'}
            </button>
          )
        })}
      </div>

      {/* Font preview */}
      <div
        style={{
          fontSize: 15,
          fontFamily: `'${currentFont}', serif`,
          color: 'rgba(255,255,255,0.8)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minHeight: 22,
        }}
      >
        {currentFont}
      </div>

      {/* Accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {CATEGORIES.map((cat) => {
          const isOpen = openCategory === cat.name
          return (
            <div key={cat.name} style={{ borderRadius: 6, overflow: 'hidden' }}>
              {/* Category header */}
              <button
                onClick={() => handleCategoryClick(cat.name)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: isOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: isOpen ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: isOpen ? '6px 6px 0 0' : 6,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: isOpen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    transition: 'color 0.15s',
                  }}
                >
                  {cat.name}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.3)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {/* Subcategory chips */}
              {isOpen && (
                <div
                  style={{
                    padding: '8px 10px 10px',
                    background: '#1e1e1e',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderTop: 'none',
                    borderRadius: '0 0 6px 6px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 5,
                    }}
                  >
                    {cat.subs.map((sub) => {
                      const selected = openSub === sub.name
                      return (
                        <button
                          key={sub.name}
                          onClick={() => handleSubClick(sub)}
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            borderRadius: 20,
                            border: selected
                              ? '1px solid rgba(255,255,255,0.3)'
                              : '1px solid rgba(255,255,255,0.1)',
                            background: selected
                              ? 'rgba(255,255,255,0.15)'
                              : 'rgba(255,255,255,0.05)',
                            color: selected ? '#ffffff' : 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            outline: 'none',
                            transition: 'all 0.12s',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {sub.name}
                        </button>
                      )
                    })}
                  </div>

                  {/* Font select dropdown — shown below chips when a sub is open */}
                  {openSub && cat.subs.find((s) => s.name === openSub) && (() => {
                    const activeSub = cat.subs.find((s) => s.name === openSub)
                    return (
                      <select
                        value={currentFont}
                        onChange={(e) => handleFontSelect(e.target.value)}
                        style={{
                          background: '#1a1a1a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6,
                          color: '#ffffff',
                          fontSize: 12,
                          padding: '6px 8px',
                          width: '100%',
                          marginTop: 8,
                          outline: 'none',
                          cursor: 'pointer',
                          appearance: 'auto',
                        }}
                      >
                        {activeSub.fonts.map((font) => (
                          <option key={font} value={font} style={{ background: '#1a1a1a' }}>
                            {font}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useState, useCallback } from 'react'

const PAGE_SIZE = 10

function buildSearchUrl(query, limit = 30) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime',
    iiurlwidth: '400',
  })
  return `https://commons.wikimedia.org/w/api.php?${params}`
}

// addedUrls: array of URLs already in the grid
// onSelect: called with (url) when user confirms "Add to Grid"
// currentUrl + onSelect: editor single-select mode (no addedUrls)
export default function WikimediaSearch({ currentUrl, onSelect, addedUrls }) {
  const [query, setQuery] = useState('')
  const [allResults, setAllResults] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  // pending = item highlighted but not yet added
  const [pending, setPending] = useState(null)
  const [pendingTemplate, setPendingTemplate] = useState('quote-bg')

  const addedSet = addedUrls ? new Set(addedUrls) : null
  const isGridMode = !!addedUrls

  const search = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setSearched(true)
    setPage(0)
    setPending(null)
    try {
      const res = await fetch(buildSearchUrl(q, 30))
      if (!res.ok) throw new Error()
      const data = await res.json()
      const pages = data.query?.pages
      if (!pages) { setAllResults([]); setLoading(false); return }
      const items = Object.values(pages)
        .filter(p => {
          const info = p.imageinfo?.[0]
          return info && info.mime?.startsWith('image/') && !info.mime.includes('svg') && info.thumburl
        })
        .map(p => ({
          title: p.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
          thumbUrl: p.imageinfo[0].thumburl,
          url: p.imageinfo[0].url,
          descriptionUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        }))
      setAllResults(items)
    } catch {
      setError('Could not connect to Wikimedia. Check your connection.')
      setAllResults([])
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleThumbClick = (item) => {
    if (isGridMode) {
      // Toggle pending selection
      setPending(prev => prev?.url === item.url ? null : item)
    } else {
      // Editor mode: immediate select
      onSelect(item.url, item)
    }
  }

  const handleAddToGrid = () => {
    if (!pending) return
    onSelect(pending.url, pending, pendingTemplate)
    setPending(null)
    setPendingTemplate('quote-bg')
  }

  const totalPages = Math.ceil(allResults.length / PAGE_SIZE)
  const pageResults = allResults.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const pendingAlreadyAdded = pending && addedSet?.has(pending.url)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Search input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Search Wikimedia Commons…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{
            flex: 1,
            background: '#1e1e1e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: '#f0f0f0',
            fontSize: 12,
            padding: '6px 8px',
            outline: 'none',
          }}
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: loading || !query.trim() ? 'rgba(255,255,255,0.3)' : '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '6px 10px',
            cursor: loading || !query.trim() ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
            outline: 'none',
          }}
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {/* Editor mode: attribution link for selected image */}
      {!isGridMode && pending && currentUrl === pending.url && (
        <a
          href={pending.descriptionUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textDecoration: 'underline', lineHeight: 1.4 }}
        >
          View on Wikimedia Commons ↗
        </a>
      )}

      {error && <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{error}</p>}

      {searched && !loading && !error && allResults.length === 0 && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
          No images found. Try a different search term.
        </p>
      )}

      {allResults.length > 0 && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          {allResults.length} result{allResults.length !== 1 ? 's' : ''}
          {totalPages > 1 ? ` · page ${page + 1} of ${totalPages}` : ''}
        </p>
      )}

      {/* Results grid */}
      {pageResults.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {pageResults.map((item) => {
            const isAdded = addedSet?.has(item.url)
            const isPending = pending?.url === item.url
            const isSelected = !isGridMode && currentUrl === item.url
            const highlighted = isPending || isSelected

            return (
              <button
                key={item.url}
                onClick={() => handleThumbClick(item)}
                title={item.title}
                style={{
                  padding: 0,
                  border: highlighted
                    ? '2px solid rgba(255,255,255,0.85)'
                    : isAdded
                    ? '2px solid rgba(255,255,255,0.3)'
                    : '2px solid transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  background: '#1a1a1a',
                  aspectRatio: '1',
                  outline: 'none',
                  position: 'relative',
                  transition: 'border-color 0.12s',
                }}
              >
                <img
                  src={item.thumbUrl}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Checkmark for already-added images */}
                {isAdded && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.9)" />
                      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Template picker + Add to Grid — only in grid mode when something is pending */}
      {isGridMode && pending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          {/* Template selector */}
          {!pendingAlreadyAdded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>
                Template
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { id: 'quote-bg', label: 'Full BG' },
                  { id: 'split-quote', label: 'Split' },
                  { id: 'saint-day', label: 'Circle' },
                ].map(t => {
                  const active = pendingTemplate === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setPendingTemplate(t.id)}
                      style={{
                        flex: 1,
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '4px 6px',
                        borderRadius: 4,
                        border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                        background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                        color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.12s',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleAddToGrid}
            disabled={pendingAlreadyAdded}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              background: pendingAlreadyAdded ? 'rgba(255,255,255,0.08)' : '#ffffff',
              color: pendingAlreadyAdded ? 'rgba(255,255,255,0.3)' : '#000000',
              fontSize: 11,
              fontWeight: 600,
              cursor: pendingAlreadyAdded ? 'default' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {pendingAlreadyAdded ? 'Already in grid' : '+ Add to Grid'}
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
              color: page === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
              cursor: page === 0 ? 'default' : 'pointer', outline: 'none',
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
              color: page === totalPages - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
              cursor: page === totalPages - 1 ? 'default' : 'pointer', outline: 'none',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

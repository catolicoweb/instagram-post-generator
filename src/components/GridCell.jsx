import { useRef, useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { drawPost, loadImage, defaultCropPos } from '../utils/drawPost'

const PREVIEW_FORMATS = {
  '4x5':  { renderW: 360, renderH: 450, displayW: 240, displayH: 300 },
  '9x16': { renderW: 253, renderH: 450, displayW: 169, displayH: 300 },
}

export default function GridCell({ post, index, total, onSelect, onEdit, onRemove, onDuplicate, isSelected, previewFormat = '4x5' }) {
  const { renderW, renderH, displayW, displayH } = PREVIEW_FORMATS[previewFormat] || PREVIEW_FORMATS['4x5']
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(false)

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: post.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const postForFormat = {
      ...post,
      quoteSize: post.quoteSizes?.[previewFormat] ?? post.quoteSize,
      authorSize: post.authorSizes?.[previewFormat] ?? post.authorSize,
    }

    if (!post.imageUrl) {
      drawPost(canvas, postForFormat, renderW, renderH, null, { x: 0, y: 0 }, 1, 1)
      return
    }

    setLoading(true)
    loadImage(post.imageUrl)
      .then(img => {
        const saved = post.cropPos?.[previewFormat]
        let cropPos, imgScale
        if (saved) {
          imgScale = saved.scale
          cropPos = { x: saved.x, y: saved.y }
        } else {
          const d = defaultCropPos(img, renderW, renderH)
          imgScale = d.scale
          cropPos = { x: d.x, y: d.y }
        }
        drawPost(canvas, postForFormat, renderW, renderH, img, cropPos, imgScale, 1)
      })
      .catch(() => drawPost(canvas, postForFormat, renderW, renderH, null, { x: 0, y: 0 }, 1, 1))
      .finally(() => setLoading(false))
  }, [post, previewFormat, renderW, renderH])

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: displayW, height: displayH }}
      className="relative group select-none"
    >
      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 z-20 rounded-sm ring-2 ring-white pointer-events-none" />
      )}

      {/* Draggable card */}
      <div
        {...attributes}
        {...listeners}
        className="relative overflow-hidden rounded-sm cursor-grab active:cursor-grabbing"
        style={{ width: displayW, height: displayH }}
      >
        {loading && (
          <div className="absolute inset-0 bg-[#1a1a1a] z-10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        )}

        <canvas ref={canvasRef} width={renderW} height={renderH}
          style={{ display: 'block', width: displayW, height: displayH }} />

        {/* Hover overlay: click body = select, action buttons at bottom */}
        <div
          onClick={() => onSelect?.()}
          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all cursor-pointer flex items-end justify-between p-2"
        >
          {/* Duplicate */}
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate?.() }}
            title="Duplicate"
            className="opacity-0 group-hover:opacity-100 transition-all bg-black/60 hover:bg-black/80 rounded-full p-1.5 flex items-center justify-center"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </button>
          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.() }}
            className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-semibold tracking-widest uppercase transition-all bg-black/60 px-2.5 py-1 rounded-full"
          >
            Edit
          </button>
        </div>

        {!post.imageUrl && !post.quote && !post.saintName && !post.author && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a] gap-2 pointer-events-none">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
            </svg>
            <span className="text-[10px] text-white/20">No image</span>
          </div>
        )}
      </div>

      {/* Top-left: checkmark when selected, number badge otherwise */}
      <div className="absolute top-1.5 left-1.5">
        {isSelected ? (
          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        ) : (
          <div className="bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded group-hover:opacity-0 transition-opacity pointer-events-none">
            {String((total ?? index + 1) - index).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Faint selection hint on hover (only when not selected) */}
      {!isSelected && (
        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full border border-white/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}

      {/* Reviewed badge — hidden on hover */}
      {post.reviewed && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/80"
        >
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
          </svg>
        </button>
      )}
    </div>
  )
}

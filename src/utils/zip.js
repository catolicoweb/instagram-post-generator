import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { loadImage, drawPost, defaultCropPos } from './drawPost'

// Use editor display dimensions + a scale factor, matching how FormatCanvas exports.
// cropPos values are stored in editor coords, so scale multiplies them to full-res.
const FORMATS = [
  { key: '1x1',  w: 400, h: 400,  scale: 1080 / 400 },   // → 1080 × 1080
  { key: '4x5',  w: 360, h: 450,  scale: 3 },             // → 1080 × 1350
  { key: '9x16', w: 253, h: 450,  scale: 1920 / 450 },    // → ~1080 × 1920
]

function slugify(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || 'post'
}

function getSlug(post) {
  const name = post.template === 'saint-day' ? post.saintName : post.author
  return slugify(name)
}

/**
 * @param {object[]} allRealPosts  — full ordered list of real posts (used for numbering)
 * @param {object}   options
 *   selectedIds  Set|null — if set, only those posts are downloaded
 *   format       'png'|'jpg'
 *   onProgress   (pct) => void
 */
export async function downloadZip(allRealPosts, { selectedIds = null, format = 'jpg', cropFormats = null, onProgress } = {}) {
  const posts = selectedIds
    ? allRealPosts.filter(p => selectedIds.has(p.id))
    : allRealPosts

  if (!posts.length) return

  const activeFormats = cropFormats?.length
    ? FORMATS.filter(f => cropFormats.includes(f.key))
    : FORMATS

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  const quality  = format === 'png' ? undefined : 0.95
  const total    = posts.length * activeFormats.length
  let done = 0
  const zip = new JSZip()

  for (const post of posts) {
    // Reversed display number (matches grid badge)
    const gridIdx    = allRealPosts.findIndex(p => p.id === post.id)
    const displayNum = String(allRealPosts.length - gridIdx).padStart(2, '0')
    const slug       = getSlug(post)

    let imgObj = null
    if (post.imageUrl) {
      try { imgObj = await loadImage(post.imageUrl) } catch {}
    }

    for (const fmt of activeFormats) {
      const canvas = document.createElement('canvas')
      const saved  = post.cropPos?.[fmt.key]

      let cropPos, imgScale
      if (saved && imgObj) {
        imgScale = saved.scale
        cropPos  = { x: saved.x, y: saved.y }
      } else if (imgObj) {
        const d  = defaultCropPos(imgObj, fmt.w, fmt.h)
        imgScale = d.scale
        cropPos  = { x: d.x, y: d.y }
      } else {
        imgScale = 1
        cropPos  = { x: 0, y: 0 }
      }

      const postForDraw = {
        ...post,
        quoteSize:  post.quoteSizes?.[fmt.key]  ?? post.quoteSize,
        authorSize: post.authorSizes?.[fmt.key] ?? post.authorSize,
      }

      drawPost(canvas, postForDraw, fmt.w, fmt.h, imgObj, cropPos, imgScale, fmt.scale)
      const blob = await new Promise(res => canvas.toBlob(res, mimeType, quality))
      zip.file(`${displayNum}_${slug}_${fmt.key}.${format}`, blob)
      done++
      onProgress?.(Math.round((done / total) * 100))
    }
  }

  const blob  = await zip.generateAsync({ type: 'blob' })
  const label = selectedIds ? 'selected' : 'all'
  saveAs(blob, `posts_${label}_${new Date().toISOString().slice(0, 10)}.zip`)
}

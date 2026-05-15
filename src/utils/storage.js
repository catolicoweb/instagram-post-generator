const KEY = 'ig-post-gen-v1'

export function savePosts(posts) {
  try { localStorage.setItem(KEY, JSON.stringify(posts)) } catch {}
}

export function loadPosts() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function exportProject(posts) {
  const real = posts.filter(p => p.imageUrl || p.quote || p.saintName || p.author)
  const blob = new Blob([JSON.stringify(real, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `posts_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function importProject(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try { resolve(JSON.parse(e.target.result)) }
      catch { reject(new Error('Invalid JSON file')) }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

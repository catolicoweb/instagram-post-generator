import { useEffect } from 'react'

const loaded = new Set()

export function useGoogleFont(family) {
  useEffect(() => {
    if (!family || loaded.has(family)) return
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
    loaded.add(family)
  }, [family])
}

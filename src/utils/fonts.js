const fontPromises = new Map()
const FULL_WEIGHT_FONTS = new Set(['Aleo'])

export function ensureFont(font) {
  if (!font) return Promise.resolve()
  if (fontPromises.has(font)) return fontPromises.get(font)

  const weights = FULL_WEIGHT_FONTS.has(font)
    ? 'ital,wght@0,100..900;1,100..900'
    : 'wght@400;500'
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:${weights}&display=swap`

  const promise = new Promise(resolve => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => {
      // Give the browser a frame to parse the @font-face rules before querying
      requestAnimationFrame(() => {
        document.fonts.load(`400 1em "${font}"`)
          .then(resolve)
          .catch(resolve)
      })
    }
    link.onerror = resolve
    document.head.appendChild(link)
  })

  fontPromises.set(font, promise)
  return promise
}

export function ensureFonts(fonts) {
  return Promise.all(fonts.filter(Boolean).map(ensureFont))
}

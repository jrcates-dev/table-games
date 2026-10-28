/**
 * Grain, generated once.
 *
 * Felt, film grain and the paper of the cards all want a little tooth, and a
 * tiled canvas of noise does it for the price of one 256px image — much
 * cheaper to composite than an SVG turbulence filter re-rendered over a table.
 */
let cached: string | null = null

export function noiseDataUrl(): string {
  if (cached) return cached
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const image = ctx.createImageData(size, size)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255
    image.data[i] = v
    image.data[i + 1] = v
    image.data[i + 2] = v
    image.data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  cached = canvas.toDataURL('image/png')
  return cached
}

/** Expose the grain to CSS as `--noise`. */
export function installNoise() {
  const url = noiseDataUrl()
  if (url) document.documentElement.style.setProperty('--noise', `url(${url})`)
}

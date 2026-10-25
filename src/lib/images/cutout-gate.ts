/**
 * Sticker printing (Bau Q10): keep the studio-backdrop flood fill, gate the
 * result, and bake a white die border only when the cut-out is clean.
 * Anything that fails the gate prints as a photo sticker instead
 * (h-add-fallback-390). Pure pixel maths, no canvas, so it runs in tests.
 */
import { crop, liftStudioBackdropFrame } from '#/lib/images/studio-backdrop'

export const GATE = {
  /** Share of the frame the product must cover. */
  minCoverage: 0.08,
  maxCoverage: 0.92,
  /** Largest connected blob as a share of all opaque pixels. */
  minMainBlob: 0.85,
  /** An edge counts as touched when this share of its length is opaque. */
  edgeTouch: 0.02,
  /** More touched edges than this means the photo was cropped through the product. */
  maxTouchedEdges: 1,
} as const

export type GateFailure = 'coverage' | 'fragmented' | 'edges'

export type GateResult =
  | { ok: true; coverage: number; mainBlob: number; touchedEdges: number }
  | {
      ok: false
      reason: GateFailure
      coverage: number
      mainBlob: number
      touchedEdges: number
    }

/** Checks a full-frame alpha mask (RGBA, alpha 0 = removed). */
export function gateCutout(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): GateResult {
  const area = width * height
  const mask = new Uint8Array(area)
  let opaque = 0
  for (let pixel = 0; pixel < area; pixel += 1) {
    if (data[pixel * 4 + 3] > 0) {
      mask[pixel] = 1
      opaque += 1
    }
  }
  const coverage = area === 0 ? 0 : opaque / area
  const mainBlob = opaque === 0 ? 0 : largestComponent(mask, width, height) / opaque
  const touchedEdges = countTouchedEdges(mask, width, height)
  const stats = { coverage, mainBlob, touchedEdges }
  if (coverage < GATE.minCoverage || coverage > GATE.maxCoverage)
    return { ok: false, reason: 'coverage', ...stats }
  if (mainBlob < GATE.minMainBlob)
    return { ok: false, reason: 'fragmented', ...stats }
  if (touchedEdges > GATE.maxTouchedEdges)
    return { ok: false, reason: 'edges', ...stats }
  return { ok: true, ...stats }
}

function largestComponent(mask: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(mask.length)
  const stack: Array<number> = []
  let best = 0
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue
    let size = 0
    seen[start] = 1
    stack.push(start)
    while (stack.length > 0) {
      const pixel = stack.pop() ?? 0
      size += 1
      const x = pixel % width
      const neighbours = [
        x > 0 ? pixel - 1 : -1,
        x + 1 < width ? pixel + 1 : -1,
        pixel >= width ? pixel - width : -1,
        pixel + width < width * height ? pixel + width : -1,
      ]
      for (const next of neighbours) {
        if (next < 0 || !mask[next] || seen[next]) continue
        seen[next] = 1
        stack.push(next)
      }
    }
    if (size > best) best = size
  }
  return best
}

function countTouchedEdges(mask: Uint8Array, width: number, height: number) {
  let top = 0
  let bottom = 0
  let left = 0
  let right = 0
  for (let x = 0; x < width; x += 1) {
    top += mask[x]
    bottom += mask[(height - 1) * width + x]
  }
  for (let y = 0; y < height; y += 1) {
    left += mask[y * width]
    right += mask[y * width + width - 1]
  }
  const horizontal = Math.max(1, width * GATE.edgeTouch)
  const vertical = Math.max(1, height * GATE.edgeTouch)
  return (
    Number(top >= horizontal) +
    Number(bottom >= horizontal) +
    Number(left >= vertical) +
    Number(right >= vertical)
  )
}

/* ------------------------------------------------------------------ */
/* Die border                                                          */
/* ------------------------------------------------------------------ */

/** Border ≈ 4% of the long side (8px on a 200px sticker), at least 6px. */
export function dieRadius(width: number, height: number) {
  return Math.max(6, Math.round(Math.max(width, height) * 0.04))
}

/**
 * Pads the cut-out and paints a white border `radius` px wide around every
 * opaque pixel (chamfer distance, anti-aliased outer edge). The product
 * stays on top; the border fills the gaps under its outline.
 */
export function bakeDie(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius = dieRadius(width, height),
) {
  const pad = Math.ceil(radius) + 2
  const outWidth = width + pad * 2
  const outHeight = height + pad * 2
  const area = outWidth * outHeight
  const far = 1e9
  const dist = new Float64Array(area).fill(far)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0)
        dist[(y + pad) * outWidth + x + pad] = 0
    }
  }
  chamfer(dist, outWidth, outHeight)

  const out = new Uint8ClampedArray(area * 4)
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const pixel = y * outWidth + x
      const coverage = Math.min(1, Math.max(0, radius + 0.5 - dist[pixel]))
      if (coverage <= 0) continue
      const target = pixel * 4
      out[target] = 255
      out[target + 1] = 255
      out[target + 2] = 255
      out[target + 3] = Math.round(coverage * 255)
      const sx = x - pad
      const sy = y - pad
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
      const source = (sy * width + sx) * 4
      const alpha = data[source + 3] / 255
      if (alpha <= 0) continue
      // Product over white.
      out[target] = Math.round(data[source] * alpha + 255 * (1 - alpha))
      out[target + 1] = Math.round(data[source + 1] * alpha + 255 * (1 - alpha))
      out[target + 2] = Math.round(data[source + 2] * alpha + 255 * (1 - alpha))
      out[target + 3] = 255
    }
  }
  return { data: out, width: outWidth, height: outHeight, radius }
}

/** Two-pass 3-4 chamfer, scaled to pixels. */
function chamfer(dist: Float64Array, width: number, height: number) {
  const straight = 1
  const diagonal = Math.SQRT2
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x
      let best = dist[pixel]
      if (x > 0) best = Math.min(best, dist[pixel - 1] + straight)
      if (y > 0) {
        best = Math.min(best, dist[pixel - width] + straight)
        if (x > 0) best = Math.min(best, dist[pixel - width - 1] + diagonal)
        if (x + 1 < width) best = Math.min(best, dist[pixel - width + 1] + diagonal)
      }
      dist[pixel] = best
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const pixel = y * width + x
      let best = dist[pixel]
      if (x + 1 < width) best = Math.min(best, dist[pixel + 1] + straight)
      if (y + 1 < height) {
        best = Math.min(best, dist[pixel + width] + straight)
        if (x + 1 < width) best = Math.min(best, dist[pixel + width + 1] + diagonal)
        if (x > 0) best = Math.min(best, dist[pixel + width - 1] + diagonal)
      }
      dist[pixel] = best
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export type StickerCut =
  | {
      kind: 'die'
      data: Uint8ClampedArray
      width: number
      height: number
    }
  | { kind: 'photo'; reason: 'no-backdrop' | GateFailure }

/** Flood fill → gate → crop → die border; or a photo-sticker verdict. */
export function cutSticker(
  source: Uint8ClampedArray,
  width: number,
  height: number,
): StickerCut {
  const frame = liftStudioBackdropFrame(source, width, height)
  if (!frame) return { kind: 'photo', reason: 'no-backdrop' }
  const gate = gateCutout(frame.data, width, height)
  if (!gate.ok) return { kind: 'photo', reason: gate.reason }
  const cropped = crop(frame.data, width, height, 0)
  if (!cropped) return { kind: 'photo', reason: 'coverage' }
  const die = bakeDie(cropped.data, cropped.width, cropped.height)
  return { kind: 'die', data: die.data, width: die.width, height: die.height }
}

/** Long side the die is printed at, so the border has a stable weight. */
export const DIE_MAX_SIDE = 800

/** Browser wrapper: decode, scale down, cut, encode PNG. */
export async function cutStickerBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, DIE_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return { kind: 'photo' as const, reason: 'no-backdrop' as const }
    context.drawImage(bitmap, 0, 0, width, height)
    const cut = cutSticker(context.getImageData(0, 0, width, height).data, width, height)
    if (cut.kind === 'photo') return cut
    canvas.width = cut.width
    canvas.height = cut.height
    context.putImageData(new ImageData(cut.data as Uint8ClampedArray<ArrayBuffer>, cut.width, cut.height), 0, 0)
    const png = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/png')
    })
    return png
      ? { kind: 'die' as const, blob: png }
      : { kind: 'photo' as const, reason: 'no-backdrop' as const }
  } finally {
    bitmap.close()
  }
}

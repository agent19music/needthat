const SAMPLE = 6
const TOLERANCE = 12
const MAX_SPREAD = 12
// Contact shadow under a sole: a pink fringe a few pixels deep. The gray
// midsole is the same lightness but has almost no chroma, so a neutral
// pixel is left alone. Deeper than this and the peel tunnels through it.
const SHADOW_DEPTH = 3
const SHADOW_CHROMA_MIN = 16
const SHADOW_CHROMA_MAX = 40
const SHADOW_LUMA_MIN = 140
const SHADOW_LUMA_MAX = 230
const LIGHT_BACKDROP = 230

// Lifts a flat studio backdrop, the white margin around a product photo.
// The screen art and the stand stay. A neural mask was eating both.
export function liftStudioBackdrop(
  source: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const area = width * height
  if (source.length !== area * 4 || width < SAMPLE * 2 || height < SAMPLE * 2)
    return null

  const backdrop = backdropColor(source, width, height)
  if (!backdrop) return null

  const drop = new Uint8Array(area)
  const stack: Array<number> = []

  function consider(x: number, y: number) {
    const pixel = y * width + x
    if (drop[pixel]) return
    if (distance(source, pixel, backdrop) > TOLERANCE) return
    drop[pixel] = 1
    stack.push(pixel)
  }

  for (let x = 0; x < width; x += 1) {
    consider(x, 0)
    consider(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    consider(0, y)
    consider(width - 1, y)
  }

  while (stack.length > 0) {
    const pixel = stack.pop() ?? 0
    const x = pixel % width
    const y = (pixel - x) / width
    if (x > 0) consider(x - 1, y)
    if (x + 1 < width) consider(x + 1, y)
    if (y > 0) consider(x, y - 1)
    if (y + 1 < height) consider(x, y + 1)
  }

  if (
    backdrop[0] >= LIGHT_BACKDROP &&
    backdrop[1] >= LIGHT_BACKDROP &&
    backdrop[2] >= LIGHT_BACKDROP
  ) {
    peelContactShadow(source, drop, width, height)
  }

  let removed = 0
  for (let pixel = 0; pixel < area; pixel += 1) if (drop[pixel]) removed += 1
  const fraction = removed / area
  if (fraction < 0.02 || fraction > 0.8) return null

  const data = new Uint8ClampedArray(source)
  for (let pixel = 0; pixel < area; pixel += 1) {
    if (!drop[pixel]) continue
    data[pixel * 4 + 3] = 0
  }
  bleed(data, width, height, 4)
  return crop(data, width, height)
}

export async function liftStudioBackdropBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(bitmap, 0, 0)
    const lifted = liftStudioBackdrop(
      context.getImageData(0, 0, bitmap.width, bitmap.height).data,
      bitmap.width,
      bitmap.height,
    )
    if (!lifted) return null
    canvas.width = lifted.width
    canvas.height = lifted.height
    context.putImageData(
      new ImageData(lifted.data, lifted.width, lifted.height),
      0,
      0,
    )
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/png')
    })
  } finally {
    bitmap.close()
  }
}

function backdropColor(
  source: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const corners = [
    [0, 0],
    [width - SAMPLE, 0],
    [0, height - SAMPLE],
    [width - SAMPLE, height - SAMPLE],
  ]
  const means: Array<[number, number, number]> = []
  for (const [x0, y0] of corners) {
    let red = 0
    let green = 0
    let blue = 0
    for (let y = y0; y < y0 + SAMPLE; y += 1) {
      for (let x = x0; x < x0 + SAMPLE; x += 1) {
        const index = (y * width + x) * 4
        red += source[index]
        green += source[index + 1]
        blue += source[index + 2]
      }
    }
    const count = SAMPLE * SAMPLE
    means.push([red / count, green / count, blue / count])
  }

  const backdrop: [number, number, number] = [0, 0, 0]
  for (const mean of means) {
    backdrop[0] += mean[0]
    backdrop[1] += mean[1]
    backdrop[2] += mean[2]
  }
  backdrop[0] /= means.length
  backdrop[1] /= means.length
  backdrop[2] /= means.length

  for (const mean of means) {
    const spread = Math.max(
      Math.abs(mean[0] - backdrop[0]),
      Math.abs(mean[1] - backdrop[1]),
      Math.abs(mean[2] - backdrop[2]),
    )
    if (spread > MAX_SPREAD) return null
  }
  return backdrop
}

// A second flood, only from the edge the white key already opened, and only
// through low-chroma pixels. Saturated leather and screen art stop it.
function peelContactShadow(
  source: Uint8ClampedArray,
  drop: Uint8Array,
  width: number,
  height: number,
) {
  const area = width * height
  const depth = new Uint8Array(area)
  const queue: Array<number> = []
  let head = 0

  function enqueue(pixel: number, next: number) {
    if (drop[pixel] || next > SHADOW_DEPTH || !isContactShadow(source, pixel))
      return
    drop[pixel] = 1
    depth[pixel] = next
    queue.push(pixel)
  }

  for (let pixel = 0; pixel < area; pixel += 1) {
    if (!drop[pixel]) continue
    const x = pixel % width
    const y = (pixel - x) / width
    if (x > 0) enqueue(pixel - 1, 1)
    if (x + 1 < width) enqueue(pixel + 1, 1)
    if (y > 0) enqueue(pixel - width, 1)
    if (y + 1 < height) enqueue(pixel + width, 1)
  }

  while (head < queue.length) {
    const pixel = queue[head]
    head += 1
    const next = depth[pixel] + 1
    if (next > SHADOW_DEPTH) continue
    const x = pixel % width
    const y = (pixel - x) / width
    if (x > 0) enqueue(pixel - 1, next)
    if (x + 1 < width) enqueue(pixel + 1, next)
    if (y > 0) enqueue(pixel - width, next)
    if (y + 1 < height) enqueue(pixel + width, next)
  }
}

function isContactShadow(source: Uint8ClampedArray, pixel: number) {
  const index = pixel * 4
  const red = source[index]
  const green = source[index + 1]
  const blue = source[index + 2]
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const chroma = max - min
  return (
    chroma >= SHADOW_CHROMA_MIN &&
    chroma <= SHADOW_CHROMA_MAX &&
    max >= SHADOW_LUMA_MIN &&
    max <= SHADOW_LUMA_MAX
  )
}

function distance(
  source: Uint8ClampedArray,
  pixel: number,
  backdrop: [number, number, number],
) {
  const index = pixel * 4
  return Math.max(
    Math.abs(source[index] - backdrop[0]),
    Math.abs(source[index + 1] - backdrop[1]),
    Math.abs(source[index + 2] - backdrop[2]),
  )
}

function bleed(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  passes: number,
) {
  for (let pass = 0; pass < passes; pass += 1) {
    const copy = new Uint8ClampedArray(data)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4
        if (data[index + 3] !== 0) continue
        let red = 0
        let green = 0
        let blue = 0
        let count = 0
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ]
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const neighbor = (ny * width + nx) * 4
          if (copy[neighbor + 3] === 0) continue
          red += copy[neighbor]
          green += copy[neighbor + 1]
          blue += copy[neighbor + 2]
          count += 1
        }
        if (count === 0) continue
        data[index] = Math.round(red / count)
        data[index + 1] = Math.round(green / count)
        data[index + 2] = Math.round(blue / count)
      }
    }
  }
}

function crop(data: Uint8ClampedArray, width: number, height: number) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null

  const pad = 2
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad)
  maxY = Math.min(height - 1, maxY + pad)
  const nextWidth = maxX - minX + 1
  const nextHeight = maxY - minY + 1
  const next = new Uint8ClampedArray(nextWidth * nextHeight * 4)
  for (let y = 0; y < nextHeight; y += 1) {
    next.set(
      data.subarray(
        (minY + y) * width * 4 + minX * 4,
        (minY + y) * width * 4 + (maxX + 1) * 4,
      ),
      y * nextWidth * 4,
    )
  }
  return { data: next, width: nextWidth, height: nextHeight }
}

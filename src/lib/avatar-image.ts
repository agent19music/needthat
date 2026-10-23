const OUTPUT_SIZE = 512
const OUTPUT_MAX_BYTES = 700_000
const LARGE_FILE_BYTES = 3 * 1024 * 1024
const WORKING_EDGE = 2048

export const CROP_CIRCLE = 0.72
export const CROP_ZOOM_MIN = 1
export const CROP_ZOOM_MAX = 3

export type PreparedPhoto = {
  url: string
  width: number
  height: number
  revoke: () => void
}

export function isImageFile(file: File) {
  if (file.type.startsWith('image/')) return true
  return /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!isImageFile(file)) {
    throw new Error('Use a photo. JPEG, PNG, and WebP work best.')
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This photo could not be read. Try a JPEG, PNG, or WebP.')
  }
  const longest = Math.max(bitmap.width, bitmap.height)
  const limit = file.size > LARGE_FILE_BYTES ? WORKING_EDGE : 4096
  const source =
    longest > limit ? await downscale(bitmap, limit / longest) : bitmap
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) {
    source.close()
    throw new Error('This photo could not be prepared.')
  }
  context.drawImage(source, 0, 0)
  source.close()
  const blob = await canvasBlob(canvas, 'image/webp', 0.92).then((encoded) =>
    encoded.type === 'image/webp'
      ? encoded
      : canvasBlob(canvas, 'image/jpeg', 0.92),
  )
  const url = URL.createObjectURL(blob)
  return {
    url,
    width: canvas.width,
    height: canvas.height,
    revoke: () => URL.revokeObjectURL(url),
  }
}

export function cropLayout(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  const stage = 100
  const circle = stage * CROP_CIRCLE
  const origin = (stage - circle) / 2
  const scale =
    Math.max(circle / imageWidth, circle / imageHeight) *
    clamp(zoom, CROP_ZOOM_MIN, CROP_ZOOM_MAX)
  const width = imageWidth * scale
  const height = imageHeight * scale
  const left = clamp((stage - width) / 2 + panX, origin + circle - width, origin)
  const top = clamp((stage - height) / 2 + panY, origin + circle - height, origin)
  return { circle, origin, scale, width, height, left, top }
}

export function panForZoom(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  panX: number,
  panY: number,
  nextZoom: number,
  originX: number,
  originY: number,
) {
  const current = cropLayout(imageWidth, imageHeight, zoom, panX, panY)
  const clampedZoom = clamp(nextZoom, CROP_ZOOM_MIN, CROP_ZOOM_MAX)
  const nextScale = circleScale(imageWidth, imageHeight) * clampedZoom
  const imageX = (originX - current.left) / current.scale
  const imageY = (originY - current.top) / current.scale
  const nextWidth = imageWidth * nextScale
  const nextHeight = imageHeight * nextScale
  return {
    zoom: clampedZoom,
    panX: originX - imageX * nextScale - (100 - nextWidth) / 2,
    panY: originY - imageY * nextScale - (100 - nextHeight) / 2,
  }
}

export async function renderAvatar(
  image: HTMLImageElement,
  zoom: number,
  panX: number,
  panY: number,
) {
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!width || !height) {
    throw new Error('The photo is not ready to crop.')
  }
  const layout = cropLayout(width, height, zoom, panX, panY)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('The photo could not be saved.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  context.drawImage(
    image,
    (layout.origin - layout.left) / layout.scale,
    (layout.origin - layout.top) / layout.scale,
    layout.circle / layout.scale,
    layout.circle / layout.scale,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )
  return encodeAvatar(canvas)
}

export function blobToBase64(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return btoa(binary)
  })
}

function circleScale(imageWidth: number, imageHeight: number) {
  return Math.max(
    (100 * CROP_CIRCLE) / imageWidth,
    (100 * CROP_CIRCLE) / imageHeight,
  )
}

async function downscale(bitmap: ImageBitmap, scale: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('This photo could not be prepared.')
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return createImageBitmap(canvas)
}

async function encodeAvatar(canvas: HTMLCanvasElement) {
  let quality = 0.82
  let type: 'image/webp' | 'image/jpeg' = 'image/webp'
  let blob = await canvasBlob(canvas, type, quality)
  if (blob.type !== 'image/webp') {
    type = 'image/jpeg'
    blob = await canvasBlob(canvas, type, quality)
  }
  while (blob.size > OUTPUT_MAX_BYTES && quality > 0.45) {
    quality = Number((quality - 0.1).toFixed(2))
    blob = await canvasBlob(canvas, type, quality)
  }
  return blob
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('The photo could not be saved.'))
      },
      type,
      quality,
    )
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

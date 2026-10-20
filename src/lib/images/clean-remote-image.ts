import { ingestProductImage, storeCleanImage } from '#/lib/images/store-image'

export async function cleanRemoteImage(itemId: string, imageUrl: string) {
  const copied = await ingestProductImage({ data: { itemId, url: imageUrl } })
  if (!copied.ok) return null

  try {
    const response = await fetch(copied.url)
    if (!response.ok) return copied.url
    const source = await response.blob()
    const { removeBackground } = await import('@imgly/background-removal')
    const cleaned = await removeBackground(source, { model: 'isnet_quint8' })
    const stored = await storeCleanImage({
      data: { itemId, imageBase64: await blobToBase64(cleaned) },
    })
    return stored.ok ? stored.url : copied.url
  } catch {
    return copied.url
  }
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const size = 0x8000
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size))
  }
  return btoa(binary)
}

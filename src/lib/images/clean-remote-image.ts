import { ingestProductImage, storeCleanImage } from '#/lib/images/store-image'
import { liftStudioBackdropBlob } from '#/lib/images/studio-backdrop'

export async function cleanRemoteImage(itemId: string, imageUrl: string) {
  const copied = await ingestProductImage({ data: { itemId, url: imageUrl } })
  if (!copied.ok) return null
  return (await cutout(itemId, copied.url)) ?? copied.url
}

export async function recutStoredImage(itemId: string) {
  return cutout(itemId, `/api/images/o-${itemId}`)
}

async function cutout(itemId: string, url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const lifted = await liftStudioBackdropBlob(await response.blob())
    if (!lifted) return null
    const stored = await storeCleanImage({
      data: { itemId, imageBase64: await blobToBase64(lifted) },
    })
    return stored.ok ? stored.url : null
  } catch {
    return null
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

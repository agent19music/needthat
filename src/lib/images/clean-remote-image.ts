import { storeCleanImage } from '#/lib/images/store-image'
import { liftStudioBackdropBlob } from '#/lib/images/studio-backdrop'
import { printFromLink } from '#/lib/images/print-sticker'

/**
 * Editor saves: copy the photo and print it as a die sticker when the cut
 * passes the quality gate, otherwise keep the copied photo.
 */
export async function cleanRemoteImage(itemId: string, imageUrl: string) {
  const printed = await printFromLink(itemId, imageUrl)
  return printed?.url ?? null
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

/**
 * Print a sticker: copy the shop photo, try a die cut (flood fill + quality
 * gate + baked white border), and fall back to a photo sticker when the cut
 * would look wrong (Bau Q10). No AGPL background-removal library.
 */
import { cutStickerBlob } from '#/lib/images/cutout-gate'
import type { GateFailure } from '#/lib/images/cutout-gate'
import { ingestProductImage, storeDieImage } from '#/lib/images/store-image'

export type PrintedSticker =
  | { kind: 'die'; url: string }
  | { kind: 'photo'; url: string; reason: 'no-backdrop' | GateFailure }

/** Copies a remote image under a per-attempt key so "Try another" never hits a cached URL. */
export async function copyForPrint(itemId: string, imageUrl: string, attempt = 0) {
  const key = attempt === 0 ? itemId : `${itemId}-t${attempt}`
  const copied = await ingestProductImage({ data: { itemId: key, url: imageUrl } })
  return copied.ok ? copied.url : null
}

/** Cuts an already-copied same-origin image (or a local upload). */
export async function cutForPrint(
  itemId: string,
  source: { url: string } | { blob: Blob },
): Promise<PrintedSticker | null> {
  try {
    const blob =
      'blob' in source
        ? source.blob
        : await fetch(source.url, { cache: 'no-store' }).then((response) =>
            response.ok ? response.blob() : null,
          )
    if (!blob) return null
    const cut = await cutStickerBlob(blob)
    if (cut.kind === 'photo') {
      return 'url' in source
        ? { kind: 'photo', url: source.url, reason: cut.reason }
        : null
    }
    const stored = await storeDieImage({
      data: { itemId, imageBase64: await blobToBase64(cut.blob) },
    })
    if (stored.ok) return { kind: 'die', url: stored.url }
    return 'url' in source
      ? { kind: 'photo', url: source.url, reason: 'no-backdrop' }
      : null
  } catch {
    return 'url' in source
      ? { kind: 'photo', url: source.url, reason: 'no-backdrop' }
      : null
  }
}

/** Copy + cut in one go; null when the image could not be copied at all. */
export async function printFromLink(itemId: string, imageUrl: string, attempt = 0) {
  const copied = await copyForPrint(itemId, imageUrl, attempt)
  if (!copied) return null
  return cutForPrint(itemId, { url: copied })
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

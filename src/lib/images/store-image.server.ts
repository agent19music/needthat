import * as Sentry from '@sentry/tanstackstart-react'

import { getImageBucket } from '#/db/index'

const MAX_BYTES = 8 * 1024 * 1024

export async function copyRemoteImage(itemId: string, url: string) {
  return Sentry.startSpan({ name: 'Copying a product image' }, async () => {
    if (!isSafeImageUrl(url)) {
      return {
        ok: false as const,
        message: 'That image link cannot be copied.',
      }
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      return {
        ok: false as const,
        message: 'The product image could not be downloaded.',
      }
    }
    const type =
      response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!type.startsWith('image/')) {
      return {
        ok: false as const,
        message: 'The link did not return an image.',
      }
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return {
        ok: false as const,
        message: 'The product image is too large to copy.',
      }
    }

    const key = `o-${itemId}`
    await getImageBucket().put(key, bytes, {
      httpMetadata: { contentType: type },
    })
    return { ok: true as const, url: `/api/images/${key}` }
  })
}

export async function saveCleanImage(itemId: string, imageBase64: string) {
  return Sentry.startSpan(
    { name: 'Storing a cleaned product image' },
    async () => {
      const bytes = Uint8Array.from(atob(imageBase64), (character) =>
        character.charCodeAt(0),
      )
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
        return {
          ok: false as const,
          message: 'The cleaned image is too large to store.',
        }
      }
      const key = `c-${itemId}-v5`
      await getImageBucket().put(key, bytes, {
        httpMetadata: { contentType: 'image/png' },
      })
      return { ok: true as const, url: `/api/images/${key}` }
    },
  )
}

export async function putImageObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
) {
  await getImageBucket().put(key, bytes, {
    httpMetadata: { contentType },
  })
  return `/api/images/${key}`
}

export function decodeImageBase64(imageBase64: string, maxBytes: number) {
  try {
    const bytes = Uint8Array.from(atob(imageBase64), (character) =>
      character.charCodeAt(0),
    )
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null
    const contentType = sniffImage(bytes)
    if (!contentType) return null
    return { bytes, contentType }
  } catch {
    return null
  }
}

function sniffImage(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (bytes.byteLength > 12) {
    const riff = String.fromCharCode(...bytes.subarray(0, 4))
    const webp = String.fromCharCode(...bytes.subarray(8, 12))
    if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif'
  }
  return null
}

export function isSafeImageUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  )
    return false
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return false
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false
  return true
}

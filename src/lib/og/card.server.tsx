import { waitUntil } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
import { getRequestUrl } from '@tanstack/react-start/server'

import { getDb, getImageBucket } from '#/db/index'
import { user } from '#/db/schema'
import { isSafeImageUrl } from '#/lib/images/store-image.server'
import { OG, OG_FONTS, imageAspect, ogContent, ogSvg } from '#/lib/og/og-layout'
import type { OgSticker } from '#/lib/og/og-layout'
import { stickerKind } from '#/lib/sticker/sheets'
import { loadPublicWishlist } from '#/lib/wishlist/public.server'
import type { PublicWishlist } from '#/lib/wishlist/types'

let resvgReady: Promise<void> | undefined

function ensureResvg() {
  // A module reload (dev HMR) keeps the wasm instance: "Already initialized".
  resvgReady ??= initWasm(resvgWasm).catch((error: unknown) => {
    if (!(error instanceof Error && /already initialized/i.test(error.message)))
      throw error
  })
  return resvgReady
}

const fontCache = new Map<string, Promise<ArrayBuffer>>()

function loadFont(origin: string, path: string) {
  const url = new URL(path, origin).href
  const cached = fontCache.get(url)
  if (cached) return cached
  const pending = fetch(url).then(async (response) => {
    if (!response.ok)
      throw new Error('The share card font could not be loaded.')
    return response.arrayBuffer()
  })
  fontCache.set(url, pending)
  return pending
}

export function warmShareCardForUser(userId: string) {
  let origin = ''
  try {
    origin = getRequestUrl().origin
  } catch {
    return
  }
  waitUntil(
    (async () => {
      const person = await getDb()
        .select({ username: user.username })
        .from(user)
        .where(eq(user.id, userId))
        .get()
      if (!person?.username) return
      await readOrRenderShareCard(person.username, origin)
    })().catch((error: unknown) => {
      console.error(error)
    }),
  )
}

/**
 * B3·06 OG card for a whole wishlist, or one sheet with `?sheet=<tag id>`.
 * Only wanted stickers are drawn; prices never are.
 */
export async function readOrRenderShareCard(
  username: string,
  origin: string,
  sheetId?: string | null,
) {
  const loaded = await loadPublicWishlist(username)
  if (!loaded) return null
  const content = ogContent(loaded, sheetId ?? null)
  if (!content) return null
  const key = `o3-${OG.width}x${OG.height}-${loaded.imageVersion}${sheetId ? `-${sheetId}` : ''}`
  const cached = await getImageBucket().get(key)
  if (cached) return new Uint8Array(await cached.arrayBuffer())
  const png = await drawCard(loaded, origin, content)
  await getImageBucket().put(key, png, {
    httpMetadata: { contentType: 'image/png' },
  })
  return png
}

async function drawCard(
  profile: PublicWishlist,
  origin: string,
  content: NonNullable<ReturnType<typeof ogContent>>,
) {
  await ensureResvg()
  // r5: static instances of the handoff TTFs (see OG_FONTS).
  const fonts = await Promise.all(
    OG_FONTS.map((path) => loadFont(origin, path)),
  )
  const stickers: Array<OgSticker> = await Promise.all(
    content.stickers.slice(0, 3).map(async (item) => {
      const image = await imageData(item.imageUrl)
      return {
        id: item.id,
        title: item.title,
        kind: stickerKind(item.imageUrl),
        src: image?.src ?? null,
        aspect: image?.aspect ?? null,
      }
    }),
  )
  const avatar = profile.image ? await imageDataUrl(profile.image) : null
  const svg = ogSvg({
    name: profile.name.trim() || profile.username,
    username: profile.username,
    avatar,
    countLine: content.countLine,
    fill: content.fill,
    tag: content.tag,
    stickers: [
      ...stickers,
      // Only the count matters past the third ("+N").
      ...content.stickers.slice(3).map((item) => ({
        id: item.id,
        title: item.title,
        kind: 'none' as const,
        src: null,
        aspect: null,
      })),
    ],
  })
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG.width },
    font: {
      fontBuffers: fonts.map((font) => new Uint8Array(font)),
      // No system fallback: a missing family must not pass as Tilt Warp.
      loadSystemFonts: false,
      defaultFontFamily: 'Funnel Sans',
      sansSerifFamily: 'Funnel Sans',
    },
  })
  const rendered = renderer.render()
  const png = new Uint8Array(rendered.asPng())
  rendered.free()
  renderer.free()
  return png
}

async function imageData(value: string | null) {
  const bytes = await imageBytes(value)
  if (!bytes) return null
  return {
    src: toDataUrl(bytes.data, bytes.type),
    aspect: imageAspect(bytes.data),
  }
}

async function imageDataUrl(value: string | null) {
  const bytes = await imageBytes(value)
  return bytes ? toDataUrl(bytes.data, bytes.type) : null
}

async function imageBytes(
  value: string | null,
): Promise<{ data: Uint8Array; type: string } | null> {
  if (!value) return null
  try {
    if (value.startsWith('/api/images/')) {
      const key = value.slice('/api/images/'.length)
      if (!/^[aocgd]-[A-Za-z0-9-]{1,160}$/.test(key)) return null
      const object = await getImageBucket().get(key)
      if (!object || object.size > 1_500_000) return null
      const type = object.httpMetadata?.contentType ?? 'image/jpeg'
      if (!type.startsWith('image/')) return null
      return { data: new Uint8Array(await object.arrayBuffer()), type }
    }
    if (!isSafeImageUrl(value)) return null
    const response = await fetch(value, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null
    const type =
      response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!type.startsWith('image/')) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > 1_500_000) return null
    return { data: bytes, type }
  } catch {
    return null
  }
}

function toDataUrl(bytes: Uint8Array, type: string) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return `data:${type};base64,${btoa(binary)}`
}

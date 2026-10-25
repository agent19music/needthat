import { waitUntil } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
import { getRequestUrl } from '@tanstack/react-start/server'

import { getDb, getImageBucket } from '#/db/index'
import { user } from '#/db/schema'
import { isSafeImageUrl } from '#/lib/images/store-image.server'
import { loadPublicWishlist } from '#/lib/wishlist/public.server'
import type { PublicWishlist } from '#/lib/wishlist/types'

const LAYOUT_WIDTH = 1024
const LAYOUT_HEIGHT = 537
const WIDTH = 1200
const HEIGHT = 630
const ANGLES = [-8, -3, 6, 12]

let resvgReady: Promise<void> | undefined

function ensureResvg() {
  resvgReady ??= initWasm(resvgWasm)
  return resvgReady
}

const fontCache = new Map<string, Promise<ArrayBuffer>>()

function loadFont(origin: string, path: string) {
  const url = new URL(path, origin).href
  const cached = fontCache.get(url)
  if (cached) return cached
  const pending = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error('The share card font could not be loaded.')
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
 * Share card for a whole wishlist, or one sheet with `?sheet=<tag id>`.
 * Only wanted stickers are drawn.
 */
export async function readOrRenderShareCard(
  username: string,
  origin: string,
  sheetId?: string | null,
) {
  const loaded = await loadPublicWishlist(username)
  if (!loaded) return null
  const sheet = sheetId
    ? (loaded.categories.find((category) => category.id === sheetId) ?? null)
    : null
  if (sheetId && !sheet) return null
  const profile = {
    ...loaded,
    items: loaded.items.filter(
      (item) =>
        item.status !== 'purchased' && (!sheet || item.categoryId === sheet.id),
    ),
  }
  if (profile.items.length === 0) return null
  const key = `g-${WIDTH}x${HEIGHT}-${profile.imageVersion}${sheet ? `-${sheet.id}` : ''}`
  const cached = await getImageBucket().get(key)
  if (cached) return new Uint8Array(await cached.arrayBuffer())
  const png = await drawCard(profile, origin, sheet?.name ?? null)
  await getImageBucket().put(key, png, {
    httpMetadata: { contentType: 'image/png' },
  })
  return png
}

async function drawCard(
  profile: PublicWishlist,
  origin: string,
  sheetName: string | null,
) {
  await ensureResvg()
  // Handoff TTFs (Bau Q8). resvg draws variable fonts at their default
  // instance, so Tilt Warp here is not at XROT 24 (listed for Bau).
  const [display, ui] = await Promise.all([
    loadFont(origin, '/fonts/sticker/TiltWarp.ttf'),
    loadFont(origin, '/fonts/sticker/FunnelSans.ttf'),
  ])
  const photos = (
    await Promise.all(
      profile.items
        .filter((item) => item.imageUrl)
        .slice(0, 4)
        .map((item) => imageDataUrl(item.imageUrl)),
    )
  ).filter((src): src is string => Boolean(src))
  const avatar = profile.image ? await imageDataUrl(profile.image) : null
  const svg = cardSvg(profile, avatar, photos, sheetName)
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      fontBuffers: [new Uint8Array(display), new Uint8Array(ui)],
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

function cardSvg(
  profile: PublicWishlist,
  avatar: string | null,
  photos: Array<string>,
  sheetName: string | null,
) {
  const owner = escapeXml(profile.name.trim() || profile.username)
  const name = sheetName
    ? `${owner}'s #${escapeXml(sheetName)}`
    : `${owner}'s wishlist`
  const frameWidth = 196
  const frameHeight = 148
  const gap = 28
  const rowWidth =
    photos.length * frameWidth + Math.max(0, photos.length - 1) * gap
  const startX = (LAYOUT_WIDTH - rowWidth) / 2
  const frameY = LAYOUT_HEIGHT - 18 - frameHeight
  const frames = photos
    .map((src, index) => {
      const x = startX + index * (frameWidth + gap)
      const angle = ANGLES[index] ?? 0
      return `<g transform="translate(${x + frameWidth / 2} ${frameY + frameHeight / 2}) rotate(${angle}) translate(${-frameWidth / 2} ${-frameHeight / 2})"><rect width="${frameWidth}" height="${frameHeight}" fill="#ffffff" filter="url(#shadow)"/><image x="8" y="8" width="180" height="132" href="${src}" preserveAspectRatio="xMidYMid slice"/></g>`
    })
    .join('')
  const nameSize = 28
  const avatarSize = 48
  const textWidth = Math.ceil(name.length * nameSize * 0.52)
  const groupWidth = (avatar ? avatarSize + 12 : 0) + textWidth
  const groupX = (LAYOUT_WIDTH - groupWidth) / 2
  const nameY = 214
  const avatarMark = avatar
    ? `<defs><clipPath id="avatar"><circle cx="${groupX + avatarSize / 2}" cy="${nameY + avatarSize / 2}" r="${avatarSize / 2}"/></clipPath></defs><image x="${groupX}" y="${nameY}" width="${avatarSize}" height="${avatarSize}" href="${avatar}" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice"/>`
    : ''
  const textX = groupX + (avatar ? avatarSize + 12 : 0)
  const scaleX = WIDTH / LAYOUT_WIDTH
  const scaleY = HEIGHT / LAYOUT_HEIGHT
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <g transform="scale(${scaleX} ${scaleY})">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000000" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="${LAYOUT_WIDTH}" height="${LAYOUT_HEIGHT}" fill="#ffffff"/>
  <text x="${LAYOUT_WIDTH / 2}" y="78" text-anchor="middle" dominant-baseline="hanging" fill="#111111" font-family="Funnel Sans" font-size="28">Sometimes, you just</text>
  <text x="${LAYOUT_WIDTH / 2}" y="120" text-anchor="middle" dominant-baseline="hanging" fill="#111111" font-family="Tilt Warp" font-size="76" letter-spacing="-2">#needthat</text>
  ${avatarMark}
  <text x="${textX}" y="${nameY + (avatar ? 10 : 0)}" dominant-baseline="hanging" fill="#111111" font-family="Funnel Sans" font-size="${nameSize}">${name}</text>
  ${frames}
  </g>
</svg>`
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function imageDataUrl(value: string | null) {
  if (!value) return null
  try {
    if (value.startsWith('/api/images/')) {
      const key = value.slice('/api/images/'.length)
      if (!/^[aocgd]-[A-Za-z0-9-]{1,160}$/.test(key)) return null
      const object = await getImageBucket().get(key)
      if (!object || object.size > 1_500_000) return null
      const type = object.httpMetadata?.contentType ?? 'image/jpeg'
      if (!type.startsWith('image/')) return null
      return toDataUrl(new Uint8Array(await object.arrayBuffer()), type)
    }
    if (!isSafeImageUrl(value)) return null
    const response = await fetch(value, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null
    const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!type.startsWith('image/')) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > 1_500_000) return null
    return toDataUrl(bytes, type)
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

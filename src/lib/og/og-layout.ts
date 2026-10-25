/**
 * r2 B3·06 OG card (1200×630) and the §4 card rule as it applies to OG:
 * text zone left (460w), sheet panel right (560×550, r30), max 3 stickers
 * in the frame's slots plus a "+N" sticker for 4+, no prices, no filters
 * (satori-safe: flat shapes, baked PNG cut-outs). Pure: no I/O.
 */
import { SHEET_FG, allSheetsMeta, buildSheets } from '#/lib/sticker/sheets'
import type { SheetFill, StickerKind } from '#/lib/sticker/sheets'
import type { GuestItem } from '#/lib/guest-wishlist'
import type { PublicWishlist } from '#/lib/wishlist/types'

export const OG = {
  width: 1200,
  height: 630,
  bg: '#F9F9FA',
  ink: '#1D1D1F',
  line: '#E2E2E5',
  /** r5: panel for white / #F9F9FA sheets. */
  paleSheet: '#EFEFF0',
  text: { x: 64, width: 460 },
  panel: { x: 600, y: 40, w: 560, h: 550, r: 30 },
  /**
   * r4 (Bau r3 review): the §4 header (112) and footer (44) zones stay clear
   * on the OG panel too; stickers, rotation included, live between them.
   */
  zone: { top: 112, bottom: 550 - 44 },
  /**
   * r5 (Bau r4 review) 3+ stickers: fixed slots, as a share of the panel
   * width with their turn. Top-left 44% −4°, top-right 40% +5°, bottom-centre
   * 44% −2°. The top row may use 180px (turned) and the bottom slot the rest
   * of the zone after a 16px gap; tall items fit by height.
   */
  slots: [
    { width: 0.44, rotate: -4, ax: 0, row: 'top' },
    { width: 0.4, rotate: 5, ax: 1, row: 'top' },
    { width: 0.44, rotate: -2, ax: 0.5, row: 'bottom' },
  ],
  row: { top: 180, gap: 16 },
  /** r4 1 sticker: centred, 70% of the panel width, −4°. */
  one: { width: 0.7, rotate: -4 },
  /**
   * r5 2 stickers: a 52%-wide slot top-left and one bottom-right, each 60%
   * of the zone tall (derived, flagged). The sticker and its turn stay inside
   * the slot, so tall items fit by height. Turns reuse the lane turns.
   */
  two: { width: 0.52, height: 0.6, rotate: [5, -3] },
  /** r5 "+N": 88 across, bottom-right of the zone, 16px clear of stickers. */
  more: { x: 560 - 22 - 88, y: 550 - 44 - 88, size: 88, clear: 16 },
  tag: { x: 40, y: 506 },
  /** §4: never closer than 12·s to the panel edge. */
  inset: 22,
} as const

/**
 * r5 OG fonts. resvg draws a variable font at its default instance only
 * (Tilt Warp XROT 0, Funnel wght 300), so the card loads static instances cut
 * from the handoff TTFs (OFL, no reserved names): Tilt Warp at XROT 24 like
 * the web type, Funnel Sans 600 and Funnel Display 700, the weights the card
 * uses. Family names stay "Tilt Warp" / "Funnel Sans" / "Funnel Display".
 */
export const OG_FONTS = [
  '/fonts/sticker/og/TiltWarp-XROT24.ttf',
  '/fonts/sticker/og/FunnelSans-SemiBold.ttf',
  '/fonts/sticker/og/FunnelDisplay-Bold.ttf',
] as const

export const SHEET_BG: Record<SheetFill, string> = {
  blue: '#2F5BEA',
  green: '#1FA45A',
  red: '#D9372B',
  white: '#FFFFFF',
  yellow: '#FFC72C',
  blank: '#EFEFF0',
  paper: '#EFEFF0',
}

export type OgSticker = {
  id: string
  title: string
  kind: StickerKind
  /** Data URL, or null when the image could not be read. */
  src: string | null
  /** Natural width / height, when known. */
  aspect: number | null
}

export type OgPlace = {
  id: string
  x: number
  y: number
  w: number
  h: number
  rotate: number
}

type Box = { x: number; y: number; w: number; h: number }

/**
 * The largest w×h (at `aspect`, w ≤ maxW) whose box turned by `rotate`
 * degrees fits inside `box`, anchored to the box's `ax`/`ay` sides (0 start,
 * .5 centre, 1 end). Tall items end up fitted by height.
 */
function fitTurned(
  id: string,
  aspect: number,
  box: Box,
  rotate: number,
  maxW: number,
  ax: number,
  ay: number,
): OgPlace {
  const rad = (Math.abs(rotate) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // Bounding box of a 1 × 1/aspect rect turned by `rotate`.
  const bw = cos + sin / aspect
  const bh = sin + cos / aspect
  const w = Math.min(maxW, box.w / bw, box.h / bh)
  const h = w / aspect
  const outerW = w * bw
  const outerH = w * bh
  const cx = box.x + outerW / 2 + (box.w - outerW) * ax
  const cy = box.y + outerH / 2 + (box.h - outerH) * ay
  return { id, x: cx - w / 2, y: cy - h / 2, w, h, rotate }
}

/**
 * r5 slots: the sticker is `width` wide (its own width, before the turn)
 * unless its turned box would be taller than `box`, then it fits by height.
 * The turned box is anchored inside `box` by `ax`/`ay`.
 */
function fitWidth(
  id: string,
  aspect: number,
  box: Box,
  rotate: number,
  width: number,
  ax: number,
  ay: number,
): OgPlace {
  const rad = (Math.abs(rotate) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const bw = cos + sin / aspect
  const bh = sin + cos / aspect
  const w = Math.min(width, box.h / bh, box.w / bw)
  const h = w / aspect
  const outerW = w * bw
  const outerH = w * bh
  const cx = box.x + outerW / 2 + (box.w - outerW) * ax
  const cy = box.y + outerH / 2 + (box.h - outerH) * ay
  return { id, x: cx - w / 2, y: cy - h / 2, w, h, rotate }
}

/**
 * r6 2-up tall items: the sticker itself is the full slot height (`box.h`)
 * and the width follows the aspect. Its turn overhangs the slot slightly; the
 * turned box is anchored to the slot's `a` corner and clamped to `area`.
 */
function fillHeight(
  id: string,
  aspect: number,
  box: Box,
  rotate: number,
  area: Box,
  a: number,
): OgPlace {
  const rad = (Math.abs(rotate) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const bw = cos + sin / aspect
  const bh = sin + cos / aspect
  const h = Math.min(box.h, (area.h / bh) * (1 / aspect), area.w / bw / aspect)
  const w = h * aspect
  const outerW = w * bw
  const outerH = w * bh
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(v, lo), hi)
  const left = clamp(
    box.x + (box.w - outerW) * a,
    area.x,
    area.x + area.w - outerW,
  )
  const top = clamp(
    box.y + (box.h - outerH) * a,
    area.y,
    area.y + area.h - outerH,
  )
  const cx = left + outerW / 2
  const cy = top + outerH / 2
  return { id, x: cx - w / 2, y: cy - h / 2, w, h, rotate }
}

/** Axis-aligned bounds of a place after its turn (panel px). */
export function turnedBounds(place: OgPlace): Box {
  const rad = (Math.abs(place.rotate) * Math.PI) / 180
  const w = place.w * Math.cos(rad) + place.h * Math.sin(rad)
  const h = place.w * Math.sin(rad) + place.h * Math.cos(rad)
  const cx = place.x + place.w / 2
  const cy = place.y + place.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/**
 * Sticker places by count (r4): 1 is centred at 70% width (−4°); 2 sit on a
 * diagonal (top-left, bottom-right) at 52% width; 3+ use the B3·06 slots plus
 * "+N". Every place keeps its turned box inside the inset and between the
 * header and footer zones; tall items fit by height.
 */
export function planOg(
  stickers: ReadonlyArray<Pick<OgSticker, 'id' | 'aspect'>>,
) {
  const { panel, zone, inset } = OG
  const area: Box = {
    x: inset,
    y: zone.top,
    w: panel.w - inset * 2,
    h: zone.bottom - zone.top,
  }
  const aspectOf = (item: Pick<OgSticker, 'aspect'>, fallback: number) =>
    item.aspect && item.aspect > 0 ? item.aspect : fallback
  let places: Array<OgPlace>
  if (stickers.length === 1) {
    const [item] = stickers
    places = [
      fitTurned(
        item.id,
        aspectOf(item, 1),
        area,
        OG.one.rotate,
        panel.w * OG.one.width,
        0.5,
        0.5,
      ),
    ]
  } else if (stickers.length === 2) {
    const w = panel.w * OG.two.width
    const h = area.h * OG.two.height
    places = stickers.map((item, index) => {
      const box: Box =
        index === 0
          ? { x: area.x, y: area.y, w, h }
          : { x: area.x + area.w - w, y: area.y + area.h - h, w, h }
      const aspect = aspectOf(item, 1)
      // r6: tall items fill the full slot height and the width follows.
      if (aspect < 1)
        return fillHeight(
          item.id,
          aspect,
          box,
          OG.two.rotate[index],
          area,
          index,
        )
      return fitTurned(
        item.id,
        aspect,
        box,
        OG.two.rotate[index],
        w,
        index,
        index,
      )
    })
  } else {
    const topH = OG.row.top
    const bottomY = area.y + topH + OG.row.gap
    places = stickers.slice(0, 3).map((item, index) => {
      const slot = OG.slots[index]
      const box: Box =
        slot.row === 'top'
          ? { x: area.x, y: area.y, w: area.w, h: topH }
          : { x: area.x, y: bottomY, w: area.w, h: area.y + area.h - bottomY }
      return fitWidth(
        item.id,
        aspectOf(item, 1.6),
        box,
        slot.rotate,
        panel.w * slot.width,
        slot.ax,
        slot.row === 'top' ? 0 : 1,
      )
    })
  }
  const hidden = Math.max(0, stickers.length - 3)
  return { places, hidden, more: hidden > 0 ? OG.more : null }
}

export type OgInput = {
  name: string
  username: string
  avatar: string | null
  /** C98 count line, e.g. "15 stickers · 5 sheets". */
  countLine: string
  fill: SheetFill
  /** Sheet tag shown on the panel, e.g. "#fits". */
  tag: string
  stickers: ReadonlyArray<OgSticker>
}

/** Rough advance widths (em) for fitting text without a layout engine. */
const EM = { tilt: 0.56, sans: 0.53 }

export function fitName(name: string) {
  let size = 66
  while (size > 44 && name.length * size * EM.tilt > OG.text.width) size -= 2
  const max = Math.floor(OG.text.width / (size * EM.tilt))
  const text =
    name.length > max
      ? `${name.slice(0, Math.max(1, max - 1)).trimEnd()}…`
      : name
  return { size, text }
}

export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  )
}

export function ogSvg(input: OgInput) {
  const { panel } = OG
  const fg = SHEET_FG[input.fill] === 'white' ? '#FFFFFF' : OG.ink
  const plan = planOg(input.stickers)
  const byId = new Map(input.stickers.map((item) => [item.id, item]))
  const name = fitName(input.name)
  const word = { x: 64, y: 64, h: 44, w: 160 }
  const av = { x: 64, y: 200, size: 88 }
  const nameTop = av.y + av.size + 22
  const userTop = nameTop + name.size + 14
  const countTop = userTop + 24 + 36

  const stickerMarks = plan.places
    .map((place, index) => {
      const item = byId.get(place.id)
      if (!item) return ''
      const cx = panel.x + place.x + place.w / 2
      const cy = panel.y + place.y + place.h / 2
      const open = `<g transform="translate(${r(cx)} ${r(cy)}) rotate(${place.rotate}) translate(${r(-place.w / 2)} ${r(-place.h / 2)})">`
      if (!item.src)
        return `${open}<rect width="${r(place.w)}" height="${r(place.h)}" rx="18" fill="#FFFFFF"/><text x="${r(place.w / 2)}" y="${r(place.h / 2)}" text-anchor="middle" dominant-baseline="central" font-family="Tilt Warp" font-size="40" fill="${OG.ink}">${esc(initials(item.title))}</text></g>`
      if (item.kind === 'photo')
        return `${open}<defs><clipPath id="ph${index}"><rect x="7" y="7" width="${r(place.w - 14)}" height="${r(place.h - 14)}" rx="12"/></clipPath></defs><rect width="${r(place.w)}" height="${r(place.h)}" rx="18" fill="#FFFFFF"/><image x="7" y="7" width="${r(place.w - 14)}" height="${r(place.h - 14)}" href="${item.src}" clip-path="url(#ph${index})" preserveAspectRatio="xMidYMid slice"/></g>`
      return `${open}<image width="${r(place.w)}" height="${r(place.h)}" href="${item.src}" preserveAspectRatio="xMidYMid meet"/></g>`
    })
    .join('')

  const more = plan.more
    ? (() => {
        const half = plan.more.size / 2
        const cx = panel.x + plan.more.x + half
        const cy = panel.y + plan.more.y + half
        return `<g transform="translate(${r(cx)} ${r(cy)}) rotate(8)"><circle r="${r(half - 1.5)}" fill="#FFFFFF" stroke="${OG.ink}" stroke-width="3"/><text y="-4" text-anchor="middle" font-family="Funnel Display" font-weight="700" font-size="31" fill="${OG.ink}">+${plan.hidden}</text><text y="22" text-anchor="middle" font-family="Funnel Sans" font-weight="600" font-size="17" fill="${OG.ink}">more</text></g>`
      })()
    : ''

  const avatar = input.avatar
    ? `<defs><clipPath id="av"><circle cx="0" cy="0" r="${av.size / 2 - 5}"/></clipPath></defs><circle r="${av.size / 2}" fill="#FFFFFF"/><image x="${-av.size / 2 + 5}" y="${-av.size / 2 + 5}" width="${av.size - 10}" height="${av.size - 10}" href="${input.avatar}" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle r="${av.size / 2}" fill="#FFFFFF"/><circle r="${av.size / 2 - 5}" fill="#2F5BEA"/><text text-anchor="middle" dominant-baseline="central" font-family="Tilt Warp" font-size="28" fill="#FFFFFF">${esc(initials(input.name))}</text>`

  // r5: a white (or page-grey) sheet would vanish on the #F9F9FA card, so
  // the panel uses #EFEFF0 and the stickers keep their white border.
  const panelFill =
    input.fill === 'white' || SHEET_BG[input.fill] === OG.bg
      ? OG.paleSheet
      : SHEET_BG[input.fill]

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG.width}" height="${OG.height}" viewBox="0 0 ${OG.width} ${OG.height}" xmlns="http://www.w3.org/2000/svg">
<rect width="${OG.width}" height="${OG.height}" fill="${OG.bg}"/>
<g transform="translate(${word.x + word.w / 2} ${word.y + word.h / 2}) rotate(-3)"><rect x="${-word.w / 2}" y="${-word.h / 2}" width="${word.w}" height="${word.h}" rx="${word.h / 2}" fill="#FFC72C" stroke="#FFFFFF" stroke-width="3"/><text y="-2" text-anchor="middle" dominant-baseline="central" font-family="Tilt Warp" font-size="30" letter-spacing="-0.9" fill="${OG.ink}">#needthat</text></g>
<g transform="translate(${av.x + av.size / 2} ${av.y + av.size / 2}) rotate(-4)">${avatar}</g>
<text x="${OG.text.x}" y="${nameTop}" dominant-baseline="hanging" font-family="Tilt Warp" font-size="${name.size}" letter-spacing="${r(-0.03 * name.size)}" fill="${OG.ink}">${esc(name.text)}</text>
<text x="${OG.text.x}" y="${userTop}" dominant-baseline="hanging" font-family="Funnel Sans" font-weight="600" font-size="24" fill="${OG.ink}">@${esc(input.username)}</text>
<text x="${OG.text.x}" y="${countTop}" dominant-baseline="hanging" font-family="Funnel Display" font-weight="700" font-size="22" fill="${OG.ink}">${esc(input.countLine)}</text>
<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="${panel.r}" fill="${panelFill}"/>
${stickerMarks}
${more}
<text x="${panel.x + OG.tag.x}" y="${panel.y + OG.tag.y}" dominant-baseline="hanging" font-family="Funnel Display" font-weight="700" font-size="13" letter-spacing="1.8" fill="${fg}">${esc(input.tag.toUpperCase())}</text>
</svg>`
}

/** Width / height from a PNG, GIF, WebP or JPEG header, or null. */
export function imageAspect(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ratio = (w: number, h: number) => (w > 0 && h > 0 ? w / h : null)
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50)
      return ratio(view.getUint32(16), view.getUint32(20))
    if (bytes[0] === 0x47 && bytes[1] === 0x49)
      return ratio(view.getUint16(6, true), view.getUint16(8, true))
    if (bytes[0] === 0x52 && bytes[8] === 0x57 && bytes[9] === 0x45) {
      const chunk = String.fromCharCode(...bytes.subarray(12, 16))
      if (chunk === 'VP8X')
        return ratio(
          1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
          1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
        )
      if (chunk === 'VP8 ')
        return ratio(
          view.getUint16(26, true) & 0x3fff,
          view.getUint16(28, true) & 0x3fff,
        )
      if (chunk === 'VP8L') {
        const b = view.getUint32(21, true)
        return ratio((b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1)
      }
      return null
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null
        const marker = bytes[offset + 1]
        const length = view.getUint16(offset + 2)
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          ![0xc4, 0xc8, 0xcc].includes(marker)
        )
          return ratio(view.getUint16(offset + 7), view.getUint16(offset + 5))
        offset += 2 + length
      }
    }
  } catch {
    return null
  }
  return null
}

function r(value: number) {
  return Math.round(value * 10) / 10
}

export function esc(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Which sheet the panel shows: `?sheet=` when given, else the first filled
 * sheet (B3·06 shows one sheet; which one for the whole-list card is
 * unspecced, flagged). Count line is C98 ("15 stickers · 5 sheets").
 */
export function ogContent(profile: PublicWishlist, sheetId: string | null) {
  const items = profile.items.map((sticker): GuestItem => ({
    id: sticker.id,
    title: sticker.title,
    brand: sticker.brand,
    notes: '',
    sourceUrl: sticker.sourceUrl,
    categoryId: sticker.categoryId,
    status: sticker.status,
    image: null,
    imageType: null,
    imageUrl: sticker.imageUrl,
    position: sticker.position,
    purchasedAt: sticker.purchasedAt,
    price: null,
    createdAt: sticker.createdAt,
    updatedAt: sticker.createdAt,
  }))
  const sets = buildSheets(items, profile.categories)
  const filled = sets.filled.filter((sheet) => sheet.wanted.length > 0)
  const sheet = sheetId
    ? filled.find((entry) => entry.categoryId === sheetId)
    : filled[0]
  if (!sheet) return null
  const wanted = filled.reduce((sum, entry) => sum + entry.wanted.length, 0)
  return {
    fill: (sheet.unsorted ? 'paper' : sheet.color) as SheetFill,
    tag: sheet.tag,
    stickers: sheet.wanted,
    countLine: allSheetsMeta(wanted, filled.length),
  }
}

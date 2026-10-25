/**
 * Sticker Sheet model (Bau's handoff, Direction "Sticker Sheet").
 * Pure functions only: tag colours, the NEW window, sheet building, Got
 * paging, seeded rotations and the auto layout. Components in
 * src/components/sticker read everything from here.
 */
import {
  categoryTag,
  formatPrice,
  formatTotal,
  gotTime,
  orderGot,
  orderStack,
} from '#/lib/stacks/stacks'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

export { categoryTag, formatPrice, formatTotal, gotTime, orderGot }

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/** User sheets cycle blue → green → red by creation order. Yellow is Got only. */
export const SHEET_CYCLE = ['blue', 'green', 'red'] as const
export type TagColor = (typeof SHEET_CYCLE)[number]
export type SheetFill = TagColor | 'yellow' | 'blank'

export function isTagColor(value: unknown): value is TagColor {
  return (
    typeof value === 'string' && (SHEET_CYCLE as ReadonlyArray<string>).includes(value)
  )
}

export function cycleColor(index: number): TagColor {
  const size = SHEET_CYCLE.length
  return SHEET_CYCLE[((Math.trunc(index) % size) + size) % size]
}

/** Categories in creation order (ties by id), the order the cycle follows. */
export function byCreation<T extends { id: string; createdAt: number }>(
  categories: ReadonlyArray<T>,
) {
  return [...categories].sort(
    (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

/** Stored colour wins; rows saved before colours existed take the cycle slot. */
export function tagColors(categories: ReadonlyArray<GuestCategory>) {
  const colors = new Map<string, TagColor>()
  byCreation(categories).forEach((category, index) => {
    colors.set(
      category.id,
      isTagColor(category.color) ? category.color : cycleColor(index),
    )
  })
  return colors
}

/** Colour for a tag created now: the next slot in the cycle. */
export function nextTagColor(categories: ReadonlyArray<GuestCategory>): TagColor {
  return cycleColor(categories.length)
}

/** Text colour per sheet fill (AA, see tokens.css). */
export const SHEET_FG: Record<SheetFill, 'white' | 'ink'> = {
  blue: 'white',
  green: 'ink',
  red: 'white',
  yellow: 'ink',
  blank: 'ink',
}

export type DotFill = 'yellow' | 'red' | 'blue' | 'green' | 'ink' | 'white'

/** Price dots never match the sheet they sit on. */
const DOT_CHOICES: Record<SheetFill, ReadonlyArray<DotFill>> = {
  blue: ['red', 'yellow'],
  green: ['yellow', 'red'],
  red: ['yellow', 'blue'],
  yellow: ['red', 'blue'],
  blank: ['yellow', 'red'],
}

export function dotFill(id: string, sheet: SheetFill): DotFill {
  const choices = DOT_CHOICES[sheet]
  return choices[Math.floor(seeded(id, 'dot-fill') * choices.length)]
}

/* ------------------------------------------------------------------ */
/* NEW badge                                                           */
/* ------------------------------------------------------------------ */

export const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** NEW = added in the last 7 days (Bau Q5). Got stickers never show it. */
export function isNew(item: Pick<GuestItem, 'createdAt' | 'status'>, now: number) {
  if (item.status === 'purchased') return false
  const age = now - item.createdAt
  return age >= -60_000 && age < NEW_WINDOW_MS
}

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

/** Stable [0, 1) from a string (FNV-1a), so a sticker keeps its tilt everywhere. */
export function seeded(id: string, salt = '') {
  let hash = 0x811c9dc5
  const text = `${salt}:${id}`
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x100000000
}

export const ROTATION = {
  stickerMin: 2,
  stickerMax: 6,
  hero: -6,
  dotMin: -10,
  dotMax: 14,
  sheetMin: 0.5,
  sheetMax: 1,
} as const

/** Rest tilt: ±2..6°, never 0. */
export function stickerRotation(id: string) {
  const magnitude =
    ROTATION.stickerMin +
    seeded(id, 'tilt') * (ROTATION.stickerMax - ROTATION.stickerMin)
  const sign = seeded(id, 'tilt-sign') < 0.5 ? -1 : 1
  return round(sign * magnitude, 2)
}

export function dotRotation(id: string) {
  return round(
    ROTATION.dotMin + seeded(id, 'dot') * (ROTATION.dotMax - ROTATION.dotMin),
    2,
  )
}

/** Sheets alternate around ±0.5..1° by their place on the board. */
export function sheetRotation(index: number) {
  const pattern = [-0.8, 1, -0.5, 0.8]
  return pattern[((index % pattern.length) + pattern.length) % pattern.length]
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

export type TagSheet = {
  kind: 'tag'
  key: string
  /** Category id, or null for the virtual #all / #unsorted sheet. */
  categoryId: string | null
  tag: string
  name: string
  color: TagColor
  /** 1-based place among the tag sheets, for the "SHEET 01" kicker. */
  number: number
  /** Wanted and got stickers in manual order; got ones render as ghost slots. */
  stickers: Array<GuestItem>
  wanted: Array<GuestItem>
  gotCount: number
  total: string | null
}

export type GotSheet = {
  kind: 'got'
  key: 'got'
  items: Array<GuestItem>
  count: number
  total: string | null
}

export type SheetSet = {
  /** Tags with at least one sticker, in creation order, then #unsorted. */
  filled: Array<TagSheet>
  /** Tags with no stickers yet (blank sheets). */
  blank: Array<TagSheet>
  got: GotSheet
}

/**
 * Builds the board. With no tags every wanted item sits on one #all sheet
 * (handoff S9). Items whose tag is gone, or that never had one, sit on an
 * #unsorted sheet after the tags.
 */
export function buildSheets(
  items: ReadonlyArray<GuestItem>,
  categories: ReadonlyArray<GuestCategory>,
): SheetSet {
  const ordered = byCreation(categories)
  const colors = tagColors(ordered)
  const known = new Set(ordered.map((category) => category.id))
  const filled: Array<TagSheet> = []
  const blank: Array<TagSheet> = []
  ordered.forEach((category) => {
    const sheet = tagSheet(
      category.id,
      category.name,
      colors.get(category.id) ?? 'blue',
      items.filter((item) => item.categoryId === category.id),
    )
    if (sheet.stickers.length === 0) blank.push(sheet)
    else filled.push(sheet)
  })
  const loose = items.filter(
    (item) => !item.categoryId || !known.has(item.categoryId),
  )
  if (ordered.length === 0) {
    filled.push(tagSheet(null, 'all', cycleColor(0), loose))
  } else if (loose.length > 0) {
    filled.push(
      tagSheet(null, 'unsorted', cycleColor(ordered.length), loose),
    )
  }
  filled.forEach((sheet, index) => {
    sheet.number = index + 1
  })
  blank.forEach((sheet, index) => {
    sheet.number = filled.length + index + 1
  })
  const got = orderGot(items.filter((item) => item.status === 'purchased'))
  return {
    filled: ordered.length === 0 && loose.length === 0 ? [] : filled,
    blank,
    got: {
      kind: 'got',
      key: 'got',
      items: got,
      count: got.length,
      total: formatTotal(got),
    },
  }
}

function tagSheet(
  categoryId: string | null,
  name: string,
  color: TagColor,
  members: ReadonlyArray<GuestItem>,
): TagSheet {
  const stickers = orderStack(members)
  const wanted = stickers.filter((item) => item.status !== 'purchased')
  return {
    kind: 'tag',
    key: categoryId ?? `#${name}`,
    categoryId,
    tag: categoryTag(name),
    name,
    color,
    number: 0,
    stickers,
    wanted,
    gotCount: stickers.length - wanted.length,
    total: formatTotal(wanted),
  }
}

/* ------------------------------------------------------------------ */
/* Copy helpers                                                        */
/* ------------------------------------------------------------------ */

const pad2 = (value: number) => String(value).padStart(2, '0')

/** "SHEET 02" */
export function sheetKicker(number: number) {
  return `SHEET ${pad2(number)}`
}

/**
 * "4 stickers · $400" on 1440 and the Got page, "4 · $400" on a 390 sheet
 * header (`compact`). The total is hidden when nothing has an offer.
 */
export function sheetMeta(
  count: number,
  total: string | null,
  options: { compact?: boolean } = {},
) {
  const counted = options.compact
    ? String(count)
    : `${count} ${count === 1 ? 'sticker' : 'stickers'}`
  return [counted, total].filter(Boolean).join(' · ')
}

/** "dd.mm" in the viewer's zone. */
export function dayMonth(timestamp: number) {
  const date = new Date(timestamp)
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`
}

/** "GOT 24.10" */
export function gotLabel(timestamp: number) {
  return `GOT ${dayMonth(timestamp)}`
}

/**
 * Got page sub-caption (S5). The newest sticker tells the sheet's progress,
 * "#fits · 2 of 4 got · $200 left"; older ones just say "#fits · $100".
 * Prices drop out when there is no offer (or prices are hidden).
 */
export function gotSubCaption(
  item: GuestItem,
  items: ReadonlyArray<GuestItem>,
  categories: ReadonlyArray<GuestCategory>,
  options: { newest?: boolean; showPrice?: boolean } = {},
) {
  const showPrice = options.showPrice !== false
  const category = categories.find((entry) => entry.id === item.categoryId)
  const tag = category ? categoryTag(category.name) : null
  if (!options.newest) {
    const price = showPrice ? formatPrice(item.price) : null
    const parts = [tag, price].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }
  if (!category) return null
  const members = items.filter((entry) => entry.categoryId === category.id)
  const wanted = members.filter((entry) => entry.status !== 'purchased')
  const got = members.length - wanted.length
  const left = showPrice && wanted.length > 0 ? formatTotal(wanted) : null
  return [
    `${tag} · ${got} of ${members.length} got`,
    left ? `${left} left` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "3 this year" when every got date is in the current year, else "3 stickers". */
export function gotCountLabel(items: ReadonlyArray<GuestItem>, now: number) {
  const year = new Date(now).getFullYear()
  if (
    items.length > 0 &&
    items.every((item) => new Date(gotTime(item)).getFullYear() === year)
  )
    return `${items.length} this year`
  return sheetMeta(items.length, null)
}

/** Full accessible name for a sticker button (handoff §9). */
export function stickerLabel(
  item: GuestItem,
  options: { now: number; showPrice?: boolean },
) {
  const price = options.showPrice === false ? null : formatPrice(item.price)
  const got =
    item.status === 'purchased' ? `got ${dayMonth(gotTime(item))}` : null
  return [
    item.title,
    item.brand || null,
    price,
    isNew(item, options.now) ? 'new' : null,
    got,
  ]
    .filter(Boolean)
    .join(', ')
}

/** "+3 more" overflow pill text. */
export function moreLabel(hidden: number) {
  return hidden > 0 ? `+${hidden}` : null
}

/* ------------------------------------------------------------------ */
/* Got paging (Bau Q13: the full Got page pages like a sticker book)   */
/* ------------------------------------------------------------------ */

export const GOT_PAGE_SIZE = { mobile: 6, desktop: 12 } as const

export type GotPage = {
  index: number
  items: Array<GuestItem>
}

/** Newest first, fixed slots per page. Always at least one (empty) page. */
export function paginateGot(
  items: ReadonlyArray<GuestItem>,
  perPage: number,
): Array<GotPage> {
  const size = Number.isFinite(perPage) ? Math.max(1, Math.trunc(perPage)) : 1
  const ordered = orderGot(items.filter((item) => item.status === 'purchased'))
  const pages: Array<GotPage> = []
  for (let start = 0; start < ordered.length; start += size) {
    pages.push({ index: pages.length, items: ordered.slice(start, start + size) })
  }
  return pages.length > 0 ? pages : [{ index: 0, items: [] }]
}

export function clampPage(page: number, count: number) {
  if (!Number.isFinite(page)) return 0
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.trunc(page)))
}

/** Page that holds an item, so a freshly stuck sticker opens on its page. */
export function pageOf(pages: ReadonlyArray<GotPage>, itemId: string) {
  const index = pages.findIndex((page) =>
    page.items.some((item) => item.id === itemId),
  )
  return index < 0 ? 0 : index
}

/* ------------------------------------------------------------------ */
/* Auto layout (handoff §3.3)                                          */
/* ------------------------------------------------------------------ */

/**
 * Every value is a fraction of the sheet's width, so the components can
 * render with container-query units (cqw) and stay percent-based.
 */
export type Slot = {
  id: string
  x: number
  y: number
  /** Sticker box width; the box is `size × size * BOX_RATIO`. */
  size: number
  rotate: number
  z: number
}

export type LayoutVariant = 'column' | 'wide' | 'half' | 'got' | 'page' | 'wall'

export type Layout = {
  slots: Array<Slot>
  /** Items that did not fit (desktop "+N more"). */
  hidden: number
  /** Content height in sheet widths (0 = the sheet has a fixed size). */
  height: number
  dot: number
}

/** Sticker boxes are 4:3 so wide shoes and tall chairs both fit. */
export const BOX_RATIO = 0.75
const CAPTION = 0.12

const PAGE_FIRST_ROW = 1.07
const PAGE_ROW = 0.62

type Spec = {
  width: number
  capacity: number
  size: number
  /** Per-index size when a layout mixes sizes (Got page). */
  sizeAt?: (index: number) => number
  dot: number
  place: (index: number) => { x: number; y: number }
  height?: (count: number) => number
}

const SPECS: Record<LayoutVariant, Spec> = {
  // 390: one sheet, two-column zig-zag, odd rows pushed ~40% down.
  column: {
    width: 358,
    capacity: Infinity,
    size: 0.56,
    dot: 46 / 358,
    place: (index) => ({
      x: index % 2 === 0 ? 0.4 : 0.05,
      y: 0.11 + index * 0.33,
    }),
    height: (count) =>
      count === 0 ? 0.9 : 0.11 + (count - 1) * 0.33 + 0.56 * BOX_RATIO + CAPTION + 0.14,
  },
  // 1440 full-width sheet (876×320): header column, then a row.
  wide: {
    width: 876,
    capacity: 3,
    size: 0.19,
    dot: 52 / 876,
    place: (index) => ({ x: 0.27 + index * 0.215, y: 0.05 + (index % 2) * 0.012 }),
  },
  // 1440 two-up sheet (430×452): zig-zag of four.
  half: {
    width: 430,
    capacity: 4,
    size: 0.46,
    dot: 44 / 430,
    place: (index) => ({
      x: index % 2 === 0 ? 0.5 : 0.04,
      y: [0.1, 0.33, 0.53, 0.74][index] ?? 0,
    }),
  },
  // 1440 Got sheet (560×292): two stickers after the header.
  got: {
    width: 560,
    capacity: 2,
    size: 0.27,
    dot: 44 / 560,
    place: (index) => ({ x: 0.4 + index * 0.27, y: 0.06 + index * 0.02 }),
  },
  // 1440 sheet opened from "+N more": full width, header on top, rows of five.
  wall: {
    width: 876,
    capacity: Infinity,
    size: 0.17,
    dot: 46 / 876,
    place: (index) => ({
      x: 0.03 + (index % 5) * 0.195,
      y: 0.17 + Math.floor(index / 5) * 0.2375 + (index % 2) * 0.012,
    }),
    height: (count) =>
      0.17 + Math.ceil(Math.max(1, count) / 5) * 0.2375 + 0.04,
  },
  // Got page (S5): the newest sticker large, older ones two-up below.
  page: {
    width: 358,
    capacity: Infinity,
    size: 0.42,
    dot: 44 / 358,
    place: (index) =>
      index === 0
        ? { x: 0.11, y: 0.3 }
        : {
            x: (index - 1) % 2 === 0 ? 0.056 : 0.53,
            y: PAGE_FIRST_ROW + Math.floor((index - 1) / 2) * PAGE_ROW + ((index - 1) % 2) * 0.045,
          },
    sizeAt: (index) => (index === 0 ? 0.62 : 0.42),
    height: (count) =>
      count <= 1
        ? 1.1
        : PAGE_FIRST_ROW + Math.ceil((count - 1) / 2) * PAGE_ROW + 0.1,
  },
}

/** Seeded jitter of ±12px, expressed in sheet widths. */
export const JITTER_PX = 12

export function layoutSheet(
  items: ReadonlyArray<Pick<GuestItem, 'id' | 'createdAt'>>,
  variant: LayoutVariant,
): Layout {
  const spec = SPECS[variant]
  const shown = items.slice(0, spec.capacity)
  const jitter = JITTER_PX / spec.width
  // Newest on top.
  const rank = [...shown]
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
    .map((item) => item.id)
  const slots = shown.map((item, index) => {
    const base = spec.place(index)
    const size = spec.sizeAt ? spec.sizeAt(index) : spec.size
    const x = base.x + (seeded(item.id, 'jx') * 2 - 1) * jitter
    const y = base.y + (seeded(item.id, 'jy') * 2 - 1) * jitter
    return {
      id: item.id,
      x: round(clamp(x, 12 / spec.width, 1 - size - 12 / spec.width), 4),
      y: round(Math.max(12 / spec.width, y), 4),
      size,
      rotate: stickerRotation(item.id),
      z: rank.indexOf(item.id) + 1,
    }
  })
  return {
    slots,
    hidden: Math.max(0, items.length - shown.length),
    height: spec.height ? round(spec.height(shown.length), 4) : 0,
    dot: round(spec.dot, 4),
  }
}

/** Overlap between two sticker boxes as a share of the smaller one (≤ .15 by rule). */
export function overlapRatio(a: Slot, b: Slot) {
  const ah = a.size * BOX_RATIO
  const bh = b.size * BOX_RATIO
  const width = Math.max(0, Math.min(a.x + a.size, b.x + b.size) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + ah, b.y + bh) - Math.max(a.y, b.y))
  return (width * height) / Math.min(a.size * ah, b.size * bh)
}

/* ------------------------------------------------------------------ */
/* Image kind                                                          */
/* ------------------------------------------------------------------ */

export type StickerKind = 'die' | 'cutout' | 'photo' | 'none'

/**
 * `d-` keys carry a baked die border; legacy `c-` cut-outs get the
 * render-time border filter; anything else prints as a photo sticker.
 */
export function stickerKind(imageUrl: string | null | undefined): StickerKind {
  if (!imageUrl) return 'none'
  if (imageUrl.startsWith('/api/images/d-')) return 'die'
  if (imageUrl.startsWith('/api/images/c-')) return 'cutout'
  return 'photo'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

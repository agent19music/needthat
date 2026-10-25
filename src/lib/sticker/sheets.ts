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

/**
 * User sheets cycle blue → green → red → white by creation order (r2 §5
 * New sheet). Yellow is Got only; paper is the virtual #unsorted sheet.
 */
export const SHEET_CYCLE = ['blue', 'green', 'red', 'white'] as const
export type TagColor = (typeof SHEET_CYCLE)[number]
export type SheetFill = TagColor | 'yellow' | 'blank' | 'paper'

export function isTagColor(value: unknown): value is TagColor {
  return (
    typeof value === 'string' &&
    (SHEET_CYCLE as ReadonlyArray<string>).includes(value)
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
    (a, b) =>
      a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
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
export function nextTagColor(
  categories: ReadonlyArray<GuestCategory>,
): TagColor {
  return cycleColor(categories.length)
}

/** Text colour per sheet fill (AA, see tokens.css). */
export const SHEET_FG: Record<SheetFill, 'white' | 'ink'> = {
  blue: 'white',
  green: 'ink',
  red: 'white',
  white: 'ink',
  yellow: 'ink',
  blank: 'ink',
  paper: 'ink',
}

export type DotFill = 'yellow' | 'red' | 'blue' | 'green' | 'ink' | 'white'

/** Price dots never match the sheet they sit on. */
const DOT_CHOICES: Record<SheetFill, ReadonlyArray<DotFill>> = {
  blue: ['red', 'yellow'],
  green: ['yellow', 'red'],
  red: ['yellow', 'blue'],
  white: ['yellow', 'red'],
  yellow: ['red', 'blue'],
  blank: ['yellow', 'red'],
  paper: ['yellow', 'red'],
}

export function dotFill(id: string, sheet: SheetFill): DotFill {
  const choices = DOT_CHOICES[sheet]
  return choices[Math.floor(seeded(id, 'dot-fill') * choices.length)]
}

/* ------------------------------------------------------------------ */
/* NEW badge                                                           */
/* ------------------------------------------------------------------ */

/** r2 #7: NEW lasts 72h (Bau's default; flagged for product). */
export const NEW_WINDOW_MS = 72 * 60 * 60 * 1000
export const NEW_PER_SHEET = 2

/** Inside the NEW window. Got stickers never qualify. */
export function isNew(
  item: Pick<GuestItem, 'createdAt' | 'status'>,
  now: number,
) {
  if (item.status === 'purchased') return false
  const age = now - item.createdAt
  return age >= -60_000 && age < NEW_WINDOW_MS
}

/**
 * Stickers that wear the NEW star on one sheet: inside the window, not yet
 * opened in the item view: the two newest, minus any already opened (r2 #7). Owner only;
 * exports and public pages never call this.
 */
export function newBadgeIds(
  items: ReadonlyArray<Pick<GuestItem, 'id' | 'createdAt' | 'status'>>,
  now: number,
  opened: ReadonlySet<string> = new Set(),
) {
  return new Set(
    items
      .filter((item) => isNew(item, now))
      .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))
      // r3: the badge belongs to the two newest; opening one does not pass it
      // on to the third-newest.
      .slice(0, NEW_PER_SHEET)
      .filter((item) => !opened.has(item.id))
      .map((item) => item.id),
  )
}

/* ------------------------------------------------------------------ */
/* Sort (r2 §5 Priority sort)                                          */
/* ------------------------------------------------------------------ */

export const SORT_MODES = [
  'priority',
  'newest',
  'price-desc',
  'price-asc',
] as const
export type SortMode = (typeof SORT_MODES)[number]

export function isSortMode(value: unknown): value is SortMode {
  return (
    typeof value === 'string' &&
    (SORT_MODES as ReadonlyArray<string>).includes(value)
  )
}

/**
 * Priority = manual order (list_items.position). The other modes keep
 * priority as the tie-break; items without a price sort last.
 */
export function sortStickers<T extends GuestItem>(
  items: ReadonlyArray<T>,
  mode: SortMode,
): Array<T> {
  const base = orderStack(items) as Array<T>
  if (mode === 'priority') return base
  const rank = new Map(base.map((item, index) => [item.id, index]))
  const tie = (a: T, b: T) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)
  if (mode === 'newest')
    return [...base].sort((a, b) => b.createdAt - a.createdAt || tie(a, b))
  const sign = mode === 'price-desc' ? -1 : 1
  return [...base].sort((a, b) => {
    const pa = a.price?.amount
    const pb = b.price?.amount
    if (pa == null && pb == null) return tie(a, b)
    if (pa == null) return 1
    if (pb == null) return -1
    return sign * (pa - pb) || tie(a, b)
  })
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
  /** The virtual #unsorted sheet (paper-2, r2 §5). */
  unsorted: boolean
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
  sort: SortMode = 'priority',
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
      sort,
    )
    if (sheet.stickers.length === 0) blank.push(sheet)
    else filled.push(sheet)
  })
  const loose = items.filter(
    (item) => !item.categoryId || !known.has(item.categoryId),
  )
  if (ordered.length === 0) {
    filled.push(tagSheet(null, 'all', cycleColor(0), loose, sort))
  } else if (loose.length > 0) {
    filled.push({
      ...tagSheet(null, 'unsorted', cycleColor(ordered.length), loose, sort),
      unsorted: true,
    })
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
  sort: SortMode = 'priority',
): TagSheet {
  const stickers = sortStickers(members, sort)
  const wanted = stickers.filter((item) => item.status !== 'purchased')
  return {
    kind: 'tag',
    key: categoryId ?? `#${name}`,
    categoryId,
    unsorted: false,
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
  options: { now: number; showPrice?: boolean; fresh?: boolean },
) {
  const price = options.showPrice === false ? null : formatPrice(item.price)
  const got =
    item.status === 'purchased' ? `got ${dayMonth(gotTime(item))}` : null
  return [
    item.title,
    item.brand || null,
    price,
    (options.fresh ?? isNew(item, options.now)) ? 'new' : null,
    got,
  ]
    .filter(Boolean)
    .join(', ')
}

/** Got tab caption sub: "Got 2 Sep" (B1·08). */
export function gotDate(timestamp: number) {
  const date = new Date(timestamp)
  return `Got ${date.getDate()} ${date.toLocaleString('en-GB', { month: 'short' })}`
}

/**
 * r6 panel "Added" chip, same rule as Got: "25 Oct" in the current year,
 * "25 Oct 2025" otherwise.
 */
export function addedDate(timestamp: number, now: number) {
  const date = new Date(timestamp)
  const day = `${date.getDate()} ${date.toLocaleString('en-GB', { month: 'short' })}`
  return date.getFullYear() === new Date(now).getFullYear()
    ? day
    : `${day} ${date.getFullYear()}`
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
    pages.push({
      index: pages.length,
      items: ordered.slice(start, start + size),
    })
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

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

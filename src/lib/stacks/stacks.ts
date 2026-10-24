/**
 * Stacks layout model: piles, geometry and labels from Bau's handoff
 * (needthat Direction 5 "Stacks"). Pure functions only; the components in
 * src/components/stacks read everything from here.
 */
import { compareByPosition } from '#/lib/wishlist/order'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

/** [rotate°, x px, y px], bottom → top, for the three rendered cards. */
export type CardPose = readonly [number, number, number]

export const PILE_REST: ReadonlyArray<CardPose> = [
  [-4, -5, 4],
  [3, 5, 2],
  [0, 0, 0],
]
export const PILE_FAN: ReadonlyArray<CardPose> = [
  [-10, -36, 8],
  [9, 36, 8],
  [0, 0, -8],
]
/** Only the top three items of a pile render as cards. */
export const PILE_DEPTH = 3
export const FAN_STAGGER_S = 0.035

export const CARD = {
  pile: { width: 184, height: 244 },
  pileMobile: { width: 132, height: 184 },
  stripFocus: { width: 340, height: 450, top: 36 },
  strip: { width: 280, height: 380, top: 70 },
  stripFocusMobile: { width: 270, height: 370, top: 30 },
  stripMobile: { width: 230, height: 320, top: 50 },
} as const

export type StripSlot = {
  x: number
  rotate: number
  scale: number
  width: number
  height: number
  /** Distance from the top of the board (560 desktop, 470 mobile). */
  top: number
  visible: boolean
  zIndex: number
}

/**
 * Strip pose for a card `offset` slots away from the focused one.
 * Neighbours sit at ±320 (±262 mobile) and ±560, rotated ±2°/±4°, scale 1 / .86.
 */
export function stripSlot(offset: number, mobile: boolean): StripSlot {
  const distance = Math.abs(offset)
  const side = Math.sign(offset)
  if (distance === 0)
    return {
      x: 0,
      rotate: 0,
      scale: 1,
      ...(mobile ? CARD.stripFocusMobile : CARD.stripFocus),
      visible: true,
      zIndex: 10,
    }
  if (distance === 1)
    return {
      x: side * (mobile ? 262 : 320),
      rotate: side * 2,
      scale: 1,
      ...(mobile ? CARD.stripMobile : CARD.strip),
      visible: true,
      zIndex: 9,
    }
  return {
    x: side * 560,
    rotate: side * 4,
    scale: 0.86,
    ...(mobile ? CARD.stripMobile : CARD.strip),
    // Mobile only peeks the direct neighbours.
    visible: distance === 2 && !mobile,
    zIndex: 8 - Math.min(distance, 8),
  }
}

/**
 * Fan pose for a pile card. Reduced motion keeps the rest pose. Touch never
 * fans (the caller only passes fanned=true for hover/focus), so the side
 * cards cannot spill out of a 2-column mobile tile.
 */
export function pileCardPose(
  depthFromTop: number,
  fanned: boolean,
  reducedMotion: boolean,
): CardPose {
  const index = PILE_DEPTH - 1 - depthFromTop
  const table = fanned && !reducedMotion ? PILE_FAN : PILE_REST
  return table[Math.max(0, Math.min(PILE_DEPTH - 1, index))]
}

export type PileModel =
  | {
      kind: 'category'
      id: string
      name: string
      tag: string
      items: Array<GuestItem>
      count: number
      total: string | null
    }
  | { kind: 'empty'; id: string; name: string; tag: string }
  | { kind: 'got'; items: Array<GuestItem>; count: number }
  | {
      kind: 'unsorted'
      items: Array<GuestItem>
      count: number
      total: string | null
    }

export function categoryTag(name: string) {
  return `#${name.trim().toLowerCase()}`
}

export function orderStack(items: ReadonlyArray<GuestItem>) {
  return [...items].sort((a, b) =>
    compareByPosition(
      { id: a.id, position: a.position ?? null, createdAt: a.createdAt },
      { id: b.id, position: b.position ?? null, createdAt: b.createdAt },
    ),
  )
}

export function gotTime(item: GuestItem) {
  return item.purchasedAt ?? item.updatedAt
}

/** Got items, most recently got first. */
export function orderGot(items: ReadonlyArray<GuestItem>) {
  return [...items].sort(
    (a, b) => gotTime(b) - gotTime(a) || (a.id < b.id ? -1 : 1),
  )
}

/**
 * Overview piles: one per category (wanted items only), an "#unsorted" pile
 * for items without a category, the Got pile, then empty categories.
 */
export function buildPiles(
  items: ReadonlyArray<GuestItem>,
  categories: ReadonlyArray<GuestCategory>,
): Array<PileModel> {
  const wanted = items.filter((item) => item.status !== 'purchased')
  const got = items.filter((item) => item.status === 'purchased')
  const filled: Array<PileModel> = []
  const empty: Array<PileModel> = []
  for (const category of categories) {
    const stack = orderStack(
      wanted.filter((item) => item.categoryId === category.id),
    )
    const tag = categoryTag(category.name)
    if (stack.length === 0) {
      empty.push({ kind: 'empty', id: category.id, name: category.name, tag })
      continue
    }
    filled.push({
      kind: 'category',
      id: category.id,
      name: category.name,
      tag,
      items: stack,
      count: stack.length,
      total: formatTotal(stack),
    })
  }
  const known = new Set(categories.map((category) => category.id))
  const unsorted = orderStack(
    wanted.filter((item) => !item.categoryId || !known.has(item.categoryId)),
  )
  const piles: Array<PileModel> = [...filled]
  if (unsorted.length > 0)
    piles.push({
      kind: 'unsorted',
      items: unsorted,
      count: unsorted.length,
      total: formatTotal(unsorted),
    })
  if (got.length > 0)
    piles.push({ kind: 'got', items: orderGot(got), count: got.length })
  return [...piles, ...empty]
}

/** Strip order for one category: wanted (manual order) first, then got (newest first). */
export function stripItems(
  items: ReadonlyArray<GuestItem>,
  categoryId: string,
) {
  const inStack = items.filter((item) => item.categoryId === categoryId)
  return [
    ...orderStack(inStack.filter((item) => item.status !== 'purchased')),
    ...orderGot(inStack.filter((item) => item.status === 'purchased')),
  ]
}

export function formatPrice(
  price: { amount: number; currency: string } | null | undefined,
) {
  if (!price) return null
  const whole = price.amount % 100 === 0
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency,
      maximumFractionDigits: whole ? 0 : 2,
      minimumFractionDigits: whole ? 0 : 2,
    }).format(price.amount / 100)
  } catch {
    return null
  }
}

/**
 * Sum of known prices, only when every priced item shares a currency.
 * Hidden (null) when nothing in the stack has an offer.
 */
export function formatTotal(items: ReadonlyArray<GuestItem>) {
  const priced = items.filter((item) => item.price)
  if (priced.length === 0) return null
  const currency = priced[0].price?.currency
  if (priced.some((item) => item.price?.currency !== currency)) return null
  const amount = priced.reduce(
    (sum, item) => sum + (item.price?.amount ?? 0),
    0,
  )
  return formatPrice({ amount, currency: currency as string })
}

/** Stamp text: GOT IT · DD.MM */
export function stampText(timestamp: number) {
  const date = new Date(timestamp)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `GOT IT · ${day}.${month}`
}

export function addedLabel(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp))
}

/** Accessible pile label: "#fits, 4 items, $400" */
export function pileAriaLabel(
  tag: string,
  count: number,
  total: string | null,
) {
  const noun = count === 1 ? 'item' : 'items'
  return [tag, `${count} ${noun}`, total].filter(Boolean).join(', ')
}

/** Strip header position: "2 / 4 · $400 · 1 got" */
export function stripPosition(index: number, items: ReadonlyArray<GuestItem>) {
  if (items.length === 0) return '0 / 0'
  const wanted = items.filter((item) => item.status !== 'purchased')
  const got = items.length - wanted.length
  return [
    `${index + 1} / ${items.length}`,
    formatTotal(wanted),
    got > 0 ? `${got} got` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Live-region text for the focused strip card: "Samba OG, 3 of 4" */
export function stripAnnouncement(
  item: GuestItem | undefined,
  index: number,
  count: number,
) {
  if (!item) return ''
  return `${item.title}, ${index + 1} of ${count}`
}

/** Index of the slot nearest the pointer in Arrange mode. */
export function slotFromPointer(
  pointerX: number,
  slotCentres: ReadonlyArray<number>,
) {
  let best = 0
  let bestDistance = Infinity
  slotCentres.forEach((centre, index) => {
    const distance = Math.abs(pointerX - centre)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

export const GOT_TIMELINE = {
  stampS: 0.24,
  thudS: 0.09,
  flyDelayMs: 300,
  flyS: 0.48,
  undoMs: 5000,
} as const

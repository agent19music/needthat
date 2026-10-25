/**
 * Sticker placement from Bau's r2 ADDENDUM (§2 Z1 zig-zag, §4 share card,
 * §5 wide-screen capacity) and the generators in r2/src (kit.py `zig`,
 * b1.py `two_up` / `row_full`, b3.py `card`).
 *
 * Everything is in design pixels for a sheet `width` wide. The sheet renders
 * those numbers as fractions of its own width (cqw), so a 358 design sheet on
 * a 358 phone column is pixel exact and scales on other phones.
 */

export type Lane = 'L' | 'R'

export type LayoutKind =
  /** 390 sheet (Z1). */
  | 'column'
  /** 390 Got tab / Got page (Z1, head_bottom 156, GOT pill low). */
  | 'got-column'
  /** 1440 first sheet, 876×320, one row, capacity 4. */
  | 'wide'
  /** 1440 two-up sheet, 430×452, Z1 lanes, capacity 4. */
  | 'half'
  /** 1440 Got row, 560×292, capacity 3. */
  | 'got-row'
  /** r3 B1·07 768–1199 band: Got full width (876 design, one row). */
  | 'got-wide'
  /** 1440 #unsorted / blank tile, 292×292, capacity 1. */
  | 'tile'
  /** 1440 single sheet (a tab is selected) and the 1440 Got page. */
  | 'wall'

export type LayoutInput = {
  id: string
  /** Natural width / height of the cutout, or null while unknown. */
  aspect: number | null
  ghost?: boolean
}

export type Point = { x: number; y: number }

export type Placement = {
  id: string
  lane: Lane
  /** Die bbox. */
  x: number
  y: number
  w: number
  h: number
  rotate: number
  /** Price dot: top-left and diameter. */
  dot: Point & { size: number }
  /** NEW star: top-left and diameter. */
  star: Point & { size: number }
  /** GOT pill top-left (ghosts and Got sheets). */
  pill: Point
  /** Caption box (lane wide on Z1). */
  caption: Point & { w: number }
}

export type Plan = {
  kind: LayoutKind
  width: number
  height: number
  places: Array<Placement>
  /** Items that did not fit (capacity or space); the "+N more" sticker. */
  hidden: number
  more: (Point & { size: number }) | null
}

/** Unknown aspect: a 4:3 box until the image reports its size. */
export const DEFAULT_ASPECT = 4 / 3

/** Bau §2. */
export const Z1 = {
  width: 358,
  lanes: { L: [16, 171], R: [187, 342] } as Record<Lane, [number, number]>,
  /** Space reserved above the bbox for the dot and NEW overhang. */
  overhang: 20,
  top: 20,
  headBottom: 116,
  gotHeadBottom: 156,
  stepMin: 56,
  maxW: 138,
  maxH: 138,
  captionGap: 10,
  /** Two caption lines (12/1.25 + 11 sub) ≈ 40. */
  captionH: 40,
  /** r8: the two lines as rendered (12/1.25 title + 11/1.3 sub) ≈ 29. */
  captionTextH: 29,
  cellGap: 16,
  hintReserve: 40,
  fabReserve: 76,
  jitter: [4, -3, 2, -5, 3, -2],
  rotations: [-4, 5, -3, 4, -5, 3],
  dot: 44,
  star: 46,
} as const

export const MORE_SIZE = 56

/** r3 price dots: ⌀44 minimum, growing for longer labels to ⌀56. */
export const DOT_MIN = 44
export const DOT_MAX = 56

/**
 * r3: dot diameter for a price label. Up to five characters ("$100", "$999")
 * stay at 44; "$1,000" and longer grow 5px per character, capped at 56.
 */
export function dotDiameter(label: string | null | undefined): number {
  const length = label?.length ?? 0
  return Math.min(DOT_MAX, DOT_MIN + Math.max(0, length - 5) * 5)
}

/** r3: 1440 stickers fill their lane up to this width. */
export const STICKER_MAX_WIDE = 200

/** r3: 1440 sheets hug their content with this much below the last caption. */
export const HUG_PAD = 32

/** Wide-screen capacity table (§5). Above capacity: capacity − 1 + "+N". */
export const CAPACITY: Partial<Record<LayoutKind, number>> = {
  wide: 4,
  half: 4,
  'got-row': 3,
  'got-wide': 4,
  tile: 1,
}

export const DESIGN: Record<
  LayoutKind,
  { width: number; height: number | null }
> = {
  column: { width: 358, height: null },
  'got-column': { width: 358, height: null },
  wide: { width: 876, height: 320 },
  half: { width: 430, height: 452 },
  'got-row': { width: 560, height: 292 },
  'got-wide': { width: 876, height: null },
  tile: { width: 292, height: 292 },
  wall: { width: 876, height: null },
}

/** Fit a cutout into a box: widest first, then capped by height. */
export function fitBox(
  aspect: number | null,
  limits: { maxW: number; maxH: number; minW?: number },
) {
  const ratio =
    aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_ASPECT
  let w = Math.min(limits.maxW, limits.maxH * ratio)
  if (limits.minW && w < limits.minW) w = Math.min(limits.minW, limits.maxW)
  let h = w / ratio
  // A very tall cutout at minW would run long: cap it and give up the width.
  const tallCap = limits.maxH * 1.3
  if (h > tallCap) {
    h = tallCap
    w = h * ratio
  }
  return { w: Math.round(w), h: Math.round(h) }
}

function badgeSpots(
  lane: Lane,
  box: { x: number; y: number; w: number; h: number },
  options: { dot: number; star: number; lowPill?: boolean },
) {
  const { x, y, w, h } = box
  // kit.py: dot on the outer top corner, NEW on the inner top corner.
  const dot =
    lane === 'R'
      ? { x: x + w - 26, y: y - 16, size: options.dot }
      : { x: x - 18, y: y - 16, size: options.dot }
  const star =
    lane === 'R'
      ? { x: x - 14, y: y - 18, size: options.star }
      : { x: x + w - 32, y: y - 18, size: options.star }
  const pill = options.lowPill
    ? lane === 'R'
      ? { x: x + w - 60, y: y + h - 14 }
      : { x: x + 6, y: y + h - 14 }
    : lane === 'R'
      ? { x: x + w - 58, y: y - 12 }
      : { x: x + 6, y: y - 12 }
  return { dot, star, pill }
}

type ZigOptions = {
  width: number
  lanes: Record<Lane, [number, number]>
  top: number
  headBottom: number
  stepMin: number
  maxW: number
  maxH: number
  minW?: number
  lowPill?: boolean
  dot: number
  star: number
  /** Fixed sheet height: cells that would cross it go to "+N". */
  fixedHeight?: number
  capacity?: number
  bottomReserve: number
  /** r8: measure the bottom from the caption text (390 public column). */
  textBottom?: boolean
}

/**
 * kit.py `zig`: the first sticker goes in the R lane beside the header,
 * then L, R, L… Each item starts at
 * max(y(n−1) + max(stepMin, ½·cellH(n−1)), cellBottom(n−2) + 16),
 * and the first L item never rises above the header.
 */
function zig(
  kind: LayoutKind,
  items: ReadonlyArray<LayoutInput>,
  o: ZigOptions,
): Plan {
  const total = items.length
  const limit =
    o.capacity !== undefined && total > o.capacity ? o.capacity - 1 : total
  const places: Array<Placement> = []
  const tops: Array<number> = []
  const bottoms: Array<number> = []
  for (let n = 0; n < Math.min(limit, total); n += 1) {
    const item = items[n]
    const lane: Lane = n % 2 === 0 ? 'R' : 'L'
    const [l0, l1] = o.lanes[lane]
    const { w, h } = fitBox(item.aspect, {
      maxW: Math.min(o.maxW, l1 - l0 - 4),
      maxH: o.maxH,
      minW: o.minW,
    })
    let y: number
    if (n === 0) y = o.top
    else if (n === 1)
      y = Math.max(o.headBottom, tops[0] + 0.5 * (bottoms[0] - tops[0]))
    else
      y = Math.max(
        tops[n - 1] + Math.max(o.stepMin, 0.5 * (bottoms[n - 1] - tops[n - 1])),
        bottoms[n - 2] + Z1.cellGap,
      )
    // Lane L sits under the header; keep it clear on every L item.
    if (lane === 'L') y = Math.max(y, o.headBottom)
    y = Math.round(y)
    const bt = y + Z1.overhang
    const jitter = Z1.jitter[n % 6]
    const x =
      lane === 'R'
        ? l1 - w - 2 + Math.min(0, jitter)
        : l0 + 2 + Math.max(0, jitter)
    const captionTop = bt + h + Z1.captionGap
    const bottom = captionTop + Z1.captionH
    if (o.fixedHeight !== undefined && bottom > o.fixedHeight - 12 && n > 0)
      break
    tops.push(y)
    bottoms.push(bottom)
    places.push({
      id: item.id,
      lane,
      x,
      y: bt,
      w,
      h,
      rotate: Z1.rotations[n % 6],
      ...badgeSpots(lane, { x, y: bt, w, h }, o),
      caption: { x: l0 + 2, y: captionTop, w: l1 - l0 - 8 },
    })
  }
  const hidden = total - places.length
  let more: Plan['more'] = null
  if (hidden > 0) {
    const n = places.length
    const lane: Lane = n % 2 === 0 ? 'R' : 'L'
    const [l0, l1] = o.lanes[lane]
    const last = tops.at(-1) ?? o.top
    const y = Math.max(last + 70, n > 1 ? bottoms[n - 2] : 0) + 16
    more = {
      x: Math.round((l0 + l1) / 2 - MORE_SIZE / 2),
      y: Math.round(
        o.fixedHeight !== undefined
          ? Math.min(y, o.fixedHeight - MORE_SIZE - 24)
          : y,
      ),
      size: MORE_SIZE,
    }
  }
  // r8 (minor 12): the 390 public column's §2 bottom measures from the
  // caption's text, not its 40px box (1440 keeps the r3 box + 32 rule).
  const textSlack = o.textBottom ? Z1.captionH - Z1.captionTextH : 0
  const contentBottom = Math.max(
    o.headBottom,
    ...bottoms.map((value) => value - textSlack),
    more ? more.y + more.size + 8 : 0,
  )
  return {
    kind,
    width: o.width,
    height: o.fixedHeight ?? Math.round(contentBottom + o.bottomReserve),
    places,
    hidden,
    more,
  }
}

type RowOptions = {
  width: number
  x0: number
  top: number
  offsets: ReadonlyArray<number>
  gap: number
  /** Cap on sticker width; defaults to the r3 lane fill cap (200). */
  maxW?: number
  maxH: number
  minW: number
  capacity: number
  rotations: ReadonlyArray<number>
  /** Header bottom: the sheet never hugs shorter than this. */
  headBottom: number
  lowPill?: boolean
}

/**
 * b1.py `row_full`: a single row right of the header, left to right.
 * r3: stickers fill their lane (the row split by what is shown, per the §5
 * capacity table) up to 200 wide, and the sheet hugs its content: last
 * caption bottom + 32, never shorter than the header.
 */
function row(
  kind: LayoutKind,
  items: ReadonlyArray<LayoutInput>,
  o: RowOptions,
): Plan {
  const total = items.length
  const limit = total > o.capacity ? o.capacity - 1 : total
  const hasMore = limit < total
  const places: Array<Placement> = []
  const right = o.width - 24
  const room = right - o.x0 - (hasMore ? MORE_SIZE + o.gap : 0)
  const laneW = limit > 0 ? (room - o.gap * (limit - 1)) / limit : room
  let bottom = o.headBottom
  for (let n = 0; n < limit; n += 1) {
    const item = items[n]
    const l0 = o.x0 + n * (laneW + o.gap)
    const bt = o.top + o.offsets[n % o.offsets.length]
    const { w, h } = fitBox(item.aspect, {
      maxW: Math.min(o.maxW ?? STICKER_MAX_WIDE, laneW),
      maxH: o.maxH,
      minW: Math.min(o.minW, laneW),
    })
    const x = Math.round(l0 + (laneW - w) / 2)
    const captionTop = bt + h + 12
    bottom = Math.max(bottom, captionTop + Z1.captionH)
    places.push({
      id: item.id,
      lane: 'R',
      x,
      y: bt,
      w,
      h,
      rotate: o.rotations[n % o.rotations.length],
      dot: { x: x + w - 28, y: bt - 16, size: Z1.dot },
      star: { x: x - 14, y: bt - 18, size: Z1.star },
      pill: o.lowPill
        ? { x: x + 8, y: bt - 12 }
        : { x: x + w - 58, y: bt - 10 },
      caption: { x: Math.round(l0), y: captionTop, w: Math.round(laneW) },
    })
  }
  const hidden = total - places.length
  const more =
    hidden > 0
      ? { x: right - MORE_SIZE, y: Math.round(o.top + 60), size: MORE_SIZE }
      : null
  if (more) bottom = Math.max(bottom, more.y + more.size)
  return {
    kind,
    width: o.width,
    height: Math.round(bottom + HUG_PAD),
    places,
    hidden,
    more,
  }
}

/** 4-lane zig for a whole 1440 sheet (not drawn by Bau; follows Z1 rules). */
function wall(
  items: ReadonlyArray<LayoutInput>,
  lowPill: boolean,
  headBottom: number,
): Plan {
  const width = 876
  const laneW = (width - 32 - 3 * 24) / 4
  const lanes = [0, 1, 2, 3].map((index) => {
    const l0 = 16 + index * (laneW + 24)
    return [l0, l0 + laneW] as [number, number]
  })
  const stagger = [0, 44, 14, 58]
  const floor = lanes.map((_, index) => (index === 0 ? headBottom : 22))
  const places: Array<Placement> = []
  let bottom = headBottom
  items.forEach((item, n) => {
    // First row fills right of the header first.
    const lane = (n + 1) % 4
    const [l0] = lanes[lane]
    const { w, h } = fitBox(item.aspect, {
      maxW: Math.min(200, laneW - 8),
      maxH: 170,
      minW: 120,
    })
    const y =
      floor[lane] + (n < 4 ? stagger[lane] : stagger[(lane + 2) % 4] / 2)
    const bt = y + Z1.overhang
    const jitter = Z1.jitter[n % 6]
    const x = Math.round(l0 + (laneW - w) / 2 + jitter)
    // r2: dots always on the right on the 4-lane wall so they never cross into the left neighbour.
    const side: Lane = 'R'
    const captionTop = bt + h + Z1.captionGap
    floor[lane] = captionTop + Z1.captionH + 24
    bottom = Math.max(bottom, captionTop + Z1.captionH)
    places.push({
      id: item.id,
      lane: side,
      x,
      y: bt,
      w,
      h,
      rotate: Z1.rotations[n % 6],
      ...badgeSpots(
        side,
        { x, y: bt, w, h },
        { dot: Z1.dot, star: Z1.star, lowPill },
      ),
      caption: { x: l0 + 2, y: captionTop, w: laneW - 8 },
    })
  })
  return {
    kind: 'wall',
    width,
    height: Math.round(bottom + HUG_PAD),
    places,
    hidden: 0,
    more: null,
  }
}

export function planSheet(
  kind: LayoutKind,
  items: ReadonlyArray<LayoutInput>,
  options: { fab?: boolean; hint?: boolean; textBottom?: boolean } = {},
): Plan {
  const plan = planKind(kind, items, options)
  // r3 #4: sheets hug their content; only an empty one keeps its design height.
  const design = DESIGN[kind].height
  if (items.length === 0 && design !== null && plan.height < design)
    return { ...plan, height: design }
  return plan
}

function planKind(
  kind: LayoutKind,
  items: ReadonlyArray<LayoutInput>,
  options: { fab?: boolean; hint?: boolean; textBottom?: boolean },
): Plan {
  switch (kind) {
    case 'column':
    case 'got-column':
      return zig(kind, items, {
        width: Z1.width,
        lanes: Z1.lanes,
        top: Z1.top,
        headBottom: kind === 'got-column' ? Z1.gotHeadBottom : Z1.headBottom,
        stepMin: Z1.stepMin,
        maxW: Z1.maxW,
        maxH: Z1.maxH,
        lowPill: kind === 'got-column',
        dot: Z1.dot,
        star: Z1.star,
        // r8: the public column only; the owner's hint row needs the full
        // caption box above it.
        textBottom: options.textBottom === true,
        // §2: max caption bottom + 40 + 76 (40 only without a FAB).
        bottomReserve:
          (options.hint === false && options.fab === false
            ? 0
            : Z1.hintReserve) + (options.fab === false ? 0 : Z1.fabReserve),
      })
    case 'half':
      return zig(kind, items, {
        width: 430,
        lanes: { L: [16, 207], R: [223, 414] },
        top: 22,
        headBottom: 120,
        stepMin: 74,
        // r3: fill the 191 lane (cap 200) and hug the content.
        maxW: STICKER_MAX_WIDE,
        maxH: 150,
        minW: 120,
        dot: Z1.dot,
        star: Z1.star,
        capacity: CAPACITY.half,
        bottomReserve: HUG_PAD,
      })
    case 'wide':
      return row(kind, items, {
        width: 876,
        x0: 240,
        top: 44,
        offsets: [18, 0, 24, 6, 14],
        gap: 24,
        maxH: 200,
        minW: 120,
        capacity: CAPACITY.wide ?? 4,
        rotations: [-4, 3, -3, 5],
        headBottom: Z1.headBottom,
      })
    case 'got-row':
      return row(kind, items, {
        width: 560,
        x0: 200,
        top: 70,
        offsets: [0, 30, 10],
        gap: 14,
        maxH: 160,
        minW: 100,
        capacity: CAPACITY['got-row'] ?? 3,
        rotations: [-4, 4, -3],
        headBottom: Z1.gotHeadBottom,
        lowPill: true,
      })
    case 'got-wide':
      return row(kind, items, {
        width: 876,
        x0: 240,
        top: 70,
        offsets: [0, 30, 10, 24],
        gap: 24,
        // B1·07 draws the band's Got row 180h with ~64h stickers.
        maxW: 140,
        maxH: 74,
        minW: 100,
        capacity: CAPACITY['got-wide'] ?? 4,
        rotations: [-4, 4, -3, 3],
        headBottom: Z1.gotHeadBottom,
        lowPill: true,
      })
    case 'tile': {
      const total = items.length
      if (total === 0)
        return {
          kind,
          width: 292,
          height: 292,
          places: [],
          hidden: 0,
          more: null,
        }
      const first = items[0]
      const { w, h } = fitBox(first.aspect, { maxW: 120, maxH: 100 })
      const x = 150
      const y = 122
      return {
        kind,
        width: 292,
        height: 292,
        places: [
          {
            id: first.id,
            lane: 'R',
            x,
            y,
            w,
            h,
            rotate: 4,
            dot: { x: x + w - 26, y: y - 18, size: Z1.dot },
            star: { x: x - 14, y: y - 18, size: Z1.star },
            pill: { x: x + w - 58, y: y - 12 },
            caption: { x, y: y + h + 14, w: 120 },
          },
        ],
        hidden: total - 1,
        more: total > 1 ? { x: 56, y: 170, size: MORE_SIZE } : null,
      }
    }
    case 'wall':
      return wall(items, false, 120)
  }
}

/** The 1440 Got page: the 4-lane wall with GOT pills low on each sticker. */
export function planGotWall(items: ReadonlyArray<LayoutInput>) {
  return wall(items, true, 156)
}

/* ------------------------------------------------------------------ */
/* Share card (§4)                                                     */
/* ------------------------------------------------------------------ */

export const CARD = {
  width: 300,
  height: 380,
  header: 112,
  footer: 44,
  inset: 12,
  /** x as a fraction of w, y as a fraction of the sticker zone, anchor side. */
  slots: [
    { x: 0.5, y: 0.02, lane: 'R' as Lane },
    { x: 0.06, y: 0.18, lane: 'L' as Lane },
    { x: 0.48, y: 0.58, lane: 'R' as Lane },
  ],
  /** Sticker height as a fraction of the zone, per slot (b3.py ST). */
  heights: [0.3, 0.44, 0.3],
  rotations: [-4, 5, -3],
  maxW: 0.42,
  dot: 30,
  more: { x: 0.16, y: 0.74, size: 52 },
} as const

export type CardPlan = {
  width: number
  height: number
  scale: number
  zone: { top: number; bottom: number }
  places: Array<Placement>
  hidden: number
  more: (Point & { size: number }) | null
}

/**
 * Share card, Story and OG panel: max 3 stickers in fixed slots, 4+ shows
 * 3 + "+N". Nothing (sticker, dot or badge) enters the header or footer
 * zone, and nothing crosses the 12·s inset.
 */
export function planCard(
  items: ReadonlyArray<LayoutInput>,
  size: { width: number; height: number } = CARD,
): CardPlan {
  const s = size.width / CARD.width
  const top = CARD.header * s
  const bottom = size.height - CARD.footer * s
  const zone = bottom - top
  const inset = CARD.inset * s
  const dot = CARD.dot * s
  const shown = items.slice(0, 3)
  const places: Array<Placement> = shown.map((item, index) => {
    const slot = CARD.slots[index]
    const aspect = item.aspect && item.aspect > 0 ? item.aspect : DEFAULT_ASPECT
    let h = zone * CARD.heights[index]
    let w = h * aspect
    const maxW = size.width * CARD.maxW
    if (w > maxW) {
      w = maxW
      h = w / aspect
    }
    let x = slot.x * size.width
    let y = top + slot.y * zone
    // Dot overhang must stay inside the zone and the inset.
    const dotY = y - 14 * s
    if (dotY < top) y += top - dotY
    if (y + h > bottom - 4 * s) y = bottom - 4 * s - h
    if (x + w > size.width - inset) x = size.width - inset - w
    if (x < inset) x = inset
    const dx = slot.lane === 'R' ? x + w - 30 * s : x - 10 * s
    const clampedDotX = Math.min(Math.max(dx, inset), size.width - inset - dot)
    return {
      id: item.id,
      lane: slot.lane,
      x,
      y,
      w,
      h,
      rotate: CARD.rotations[index],
      dot: { x: clampedDotX, y: y - 14 * s, size: dot },
      star: { x, y, size: 0 },
      pill: { x, y },
      caption: { x, y: y + h, w },
    }
  })
  const hidden = Math.max(0, items.length - 3)
  return {
    width: size.width,
    height: size.height,
    scale: s,
    zone: { top, bottom },
    places,
    hidden,
    more:
      hidden > 0
        ? {
            x: CARD.more.x * size.width,
            y: top + CARD.more.y * zone,
            size: CARD.more.size * s,
          }
        : null,
  }
}

/* ------------------------------------------------------------------ */
/* Geometry checks (tests and dev asserts)                             */
/* ------------------------------------------------------------------ */

export type Rect = { x: number; y: number; w: number; h: number }

export function intersects(a: Rect, b: Rect, pad = 0) {
  return (
    a.x < b.x + b.w + pad &&
    b.x < a.x + a.w + pad &&
    a.y < b.y + b.h + pad &&
    b.y < a.y + a.h + pad
  )
}

export function captionRect(place: Placement): Rect {
  return {
    x: place.caption.x,
    y: place.caption.y,
    w: place.caption.w,
    h: Z1.captionH,
  }
}

export function dotRect(place: Placement): Rect {
  return {
    x: place.dot.x,
    y: place.dot.y,
    w: place.dot.size,
    h: place.dot.size,
  }
}

export function boxRect(place: Placement): Rect {
  return { x: place.x, y: place.y, w: place.w, h: place.h }
}

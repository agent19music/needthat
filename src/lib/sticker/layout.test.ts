import { describe, expect, it } from 'vitest'
import {
  CARD,
  CAPACITY,
  DOT_MAX,
  DOT_MIN,
  dotDiameter,
  HUG_PAD,
  STICKER_MAX_WIDE,
  Z1,
  boxRect,
  captionRect,
  fitBox,
  intersects,
  planCard,
  planGotWall,
  planSheet,
} from './layout'
import type { LayoutInput } from './layout'

const shoe = 138 / 64
const many = (
  count: number,
  aspect: number | null = shoe,
): Array<LayoutInput> =>
  Array.from({ length: count }, (_, index) => ({ id: `i${index}`, aspect }))
const mixed = (count: number): Array<LayoutInput> =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    aspect: [shoe, 1, 0.7, 1.6, null][index % 5],
  }))

describe('fitBox', () => {
  it('caps width at maxW and derives height from the aspect', () => {
    expect(fitBox(shoe, { maxW: 138, maxH: 138 })).toEqual({ w: 138, h: 64 })
    expect(fitBox(1, { maxW: 138, maxH: 100 })).toEqual({ w: 100, h: 100 })
  })

  it('falls back to 4:3 for unknown or broken aspects', () => {
    expect(fitBox(null, { maxW: 120, maxH: 120 })).toEqual({ w: 120, h: 90 })
    expect(fitBox(Number.NaN, { maxW: 120, maxH: 120 })).toEqual({
      w: 120,
      h: 90,
    })
  })
})

describe('390 zig-zag (Z1, §2)', () => {
  // kit.py `zig` (B1·01): the first sticker sits in the R lane beside the
  // header, then L, R… and every L sticker clears the header.
  it('alternates R, L, R and keeps L stickers below the header', () => {
    const plan = planSheet('column', many(5))
    expect(plan.places.map((place) => place.lane)).toEqual([
      'R',
      'L',
      'R',
      'L',
      'R',
    ])
    for (const place of plan.places)
      if (place.lane === 'L')
        expect(place.y).toBeGreaterThanOrEqual(Z1.headBottom)
    expect(plan.hidden).toBe(0)
  })

  it('starts Got sheets lower for the year pill', () => {
    const wanted = planSheet('column', many(2)).places[1]
    const got = planSheet('got-column', many(2)).places[1]
    expect(got.y).toBeGreaterThanOrEqual(Z1.gotHeadBottom)
    expect(got.y).toBeGreaterThan(wanted.y)
  })

  it('keeps a shoe at ~138×64 inside its lane, overhanging only toward the centre', () => {
    const plan = planSheet('column', mixed(10))
    const first = plan.places[0]
    expect(first.w).toBeLessThanOrEqual(Z1.maxW)
    for (const place of plan.places) {
      expect(place.x).toBeGreaterThanOrEqual(12)
      expect(place.x + place.w).toBeLessThanOrEqual(Z1.width - 12)
      if (place.lane === 'L')
        expect(place.x).toBeGreaterThanOrEqual(Z1.lanes.L[0] - 0.5)
      else expect(place.x + place.w).toBeLessThanOrEqual(Z1.lanes.R[1] + 0.5)
    }
  })

  it('steps at least 56 down and never overlaps same-lane cells', () => {
    const { places } = planSheet('column', mixed(10))
    places.forEach((place, index) => {
      if (index >= 1)
        expect(place.y - places[index - 1].y).toBeGreaterThanOrEqual(
          Z1.stepMin - 0.5,
        )
      if (index >= 2) {
        const sameLane = places[index - 2]
        expect(place.y).toBeGreaterThanOrEqual(
          captionRect(sameLane).y + Z1.captionH + Z1.cellGap - 0.5,
        )
      }
    })
  })

  it('never puts a caption under another sticker or its dot', () => {
    const { places } = planSheet('column', mixed(8))
    for (const a of places) {
      for (const b of places) {
        if (a === b) continue
        expect(intersects(captionRect(a), boxRect(b))).toBe(false)
      }
    }
  })

  it('takes rotations in order from the §2 table', () => {
    const { places } = planSheet('column', many(6))
    expect(places.map((place) => place.rotate)).toEqual([...Z1.rotations])
  })

  it('reserves room for hint + FAB, and less without a FAB', () => {
    const withFab = planSheet('column', many(3))
    const publicSheet = planSheet('column', many(3), { fab: false })
    expect(withFab.height - publicSheet.height).toBe(Z1.fabReserve)
  })

  it('is deterministic', () => {
    expect(planSheet('column', mixed(7))).toEqual(planSheet('column', mixed(7)))
  })
})

describe('1440 capacity (§5)', () => {
  it('never shows more than capacity and counts the rest in "+N"', () => {
    for (const kind of ['wide', 'half', 'got-row'] as const) {
      const cap = CAPACITY[kind] ?? 0
      for (const count of [1, cap, cap + 3]) {
        const plan = planSheet(kind, many(count))
        expect(plan.places.length).toBeLessThanOrEqual(cap)
        expect(plan.places.length + plan.hidden).toBe(count)
        expect(plan.more === null).toBe(plan.hidden === 0)
        if (count > cap) expect(plan.places.length).toBeLessThanOrEqual(cap - 1)
      }
    }
  })

  it('hugs content: last caption bottom + 32, never shorter than the header (r3 #4)', () => {
    for (const kind of [
      'wide',
      'half',
      'got-row',
      'got-wide',
      'wall',
    ] as const) {
      for (const items of [many(1), many(2), mixed(3), mixed(4), many(9)]) {
        const plan = planSheet(kind, items)
        const last = Math.max(
          ...plan.places.map((p) => p.caption.y + Z1.captionH),
        )
        const head =
          kind === 'got-row' || kind === 'got-wide'
            ? Z1.gotHeadBottom
            : kind === 'half'
              ? 120
              : Z1.headBottom
        const label = `${kind}×${items.length}`
        if (plan.more) {
          // The "+N more" dot may sit lowest; it gets the same 32 (+8 breathing room max).
          const lowest = Math.max(last, head, plan.more.y + plan.more.size)
          expect(plan.height, label).toBeGreaterThanOrEqual(
            Math.round(lowest + HUG_PAD),
          )
          expect(plan.height, label).toBeLessThanOrEqual(
            Math.round(lowest + HUG_PAD + 8),
          )
        } else {
          expect(plan.height, label).toBe(
            Math.round(Math.max(last, head) + HUG_PAD),
          )
        }
      }
    }
  })

  it('keeps the design min-height only for an empty sheet (r3 #4)', () => {
    expect(planSheet('wide', []).height).toBe(320)
    expect(planSheet('half', []).height).toBe(452)
    expect(planSheet('got-row', []).height).toBe(292)
    expect(planSheet('wide', many(1)).height).toBeLessThan(320)
  })

  it('no longer pads 1440 sheets to a fixed height (r3 #4)', () => {
    expect(planSheet('wide', many(2)).height).toBeLessThan(320)
    expect(planSheet('half', many(2)).height).toBeLessThan(452)
    expect(planSheet('got-row', many(2)).height).toBeLessThan(292)
  })

  it('fills the lane up to 200 wide on 1440 (r3 #5)', () => {
    // Two shoes on the wide sheet: each lane is wider than 200, so both hit the cap.
    for (const p of planSheet('wide', many(2)).places)
      expect(p.w).toBe(STICKER_MAX_WIDE)
    // Three: lanes are (612 - 48) / 3 = 188.
    for (const p of planSheet('wide', many(3)).places) expect(p.w).toBe(188)
    // Never wider than 200 or than the lane, never overlapping the next lane.
    for (const kind of [
      'wide',
      'half',
      'got-row',
      'got-wide',
      'wall',
    ] as const) {
      for (const n of [1, 2, 3, 4, 6]) {
        const plan = planSheet(kind, mixed(n))
        for (const p of plan.places) {
          expect(p.w).toBeLessThanOrEqual(STICKER_MAX_WIDE)
          expect(p.x).toBeGreaterThanOrEqual(0)
          expect(p.x + p.w).toBeLessThanOrEqual(plan.width)
        }
        if (kind === 'wide' || kind === 'got-row' || kind === 'got-wide') {
          const xs = plan.places.map((p) => [p.x, p.x + p.w])
          for (let i = 1; i < xs.length; i += 1)
            expect(xs[i][0]).toBeGreaterThan(xs[i - 1][1])
        }
      }
    }
    expect(
      Math.max(...planSheet('half', many(2)).places.map((p) => p.w)),
    ).toBeGreaterThan(170)
  })

  it('keeps the "+N more" dot inside the wide sheet', () => {
    const plan = planSheet('wide', many(7))
    expect(plan.more).not.toBeNull()
    expect(plan.more!.x + plan.more!.size).toBeLessThanOrEqual(plan.width - 24)
    for (const p of plan.places) expect(p.x + p.w).toBeLessThan(plan.more!.x)
  })

  it('shows one sticker on a tile and counts the rest', () => {
    const tile = planSheet('tile', many(3))
    expect(tile.places).toHaveLength(1)
    expect(tile.hidden).toBe(2)
    expect(planSheet('tile', []).places).toHaveLength(0)
  })

  it('grows the wall with content and keeps stickers inside it', () => {
    const small = planSheet('wall', many(4))
    const big = planSheet('wall', many(12))
    expect(big.height).toBeGreaterThan(small.height)
    expect(big.hidden).toBe(0)
    for (const place of big.places)
      expect(place.x + place.w).toBeLessThanOrEqual(big.width)
    expect(planGotWall(many(3)).places).toHaveLength(3)
  })
})

describe('share card (§4)', () => {
  it('shows at most 3 stickers and a "+N" for the rest', () => {
    expect(planCard(many(2)).places).toHaveLength(2)
    const plan = planCard(many(6))
    expect(plan.places).toHaveLength(3)
    expect(plan.hidden).toBe(3)
    expect(plan.more).not.toBeNull()
  })

  it('keeps stickers and dots out of the header, footer and inset', () => {
    for (const size of [CARD, { width: 1080, height: 1368 }]) {
      const plan = planCard(mixed(3), size)
      const inset = CARD.inset * plan.scale
      for (const place of plan.places) {
        expect(place.y).toBeGreaterThanOrEqual(plan.zone.top - 0.01)
        expect(place.y + place.h).toBeLessThanOrEqual(plan.zone.bottom + 0.01)
        expect(place.dot.y).toBeGreaterThanOrEqual(plan.zone.top - 0.01)
        expect(place.x).toBeGreaterThanOrEqual(inset - 0.01)
        expect(place.x + place.w).toBeLessThanOrEqual(size.width - inset + 0.01)
        expect(place.dot.x).toBeGreaterThanOrEqual(inset - 0.01)
        expect(place.dot.x + place.dot.size).toBeLessThanOrEqual(
          size.width - inset + 0.01,
        )
      }
    }
  })
})

describe('dotDiameter (r3 #3)', () => {
  it('keeps short prices at the ⌀44 minimum', () => {
    for (const label of [
      '$5',
      '$40',
      '$100',
      '$999',
      '€12',
      null,
      undefined,
      '',
    ])
      expect(dotDiameter(label)).toBe(DOT_MIN)
  })

  it('grows from $1,000 up and caps at ⌀56', () => {
    expect(dotDiameter('$1,000')).toBeGreaterThan(DOT_MIN)
    expect(dotDiameter('$1,000')).toBeLessThan(DOT_MAX)
    expect(dotDiameter('$12,500')).toBeGreaterThan(dotDiameter('$1,000'))
    expect(dotDiameter('$129,999')).toBe(DOT_MAX)
    expect(dotDiameter('$1,234,567.89')).toBe(DOT_MAX)
  })

  it('never shrinks as the label gets longer', () => {
    let last = 0
    for (let n = 0; n < 16; n += 1) {
      const d = dotDiameter('9'.repeat(n))
      expect(d).toBeGreaterThanOrEqual(last)
      expect(d).toBeGreaterThanOrEqual(DOT_MIN)
      expect(d).toBeLessThanOrEqual(DOT_MAX)
      last = d
    }
  })
})

describe('got-wide (r3 B1·07 band)', () => {
  it('is a full-width 876 row with the Got header and GOT-row pills', () => {
    const plan = planSheet('got-wide', many(3))
    expect(plan.width).toBe(876)
    expect(plan.places).toHaveLength(3)
    for (const p of plan.places) {
      expect(p.x).toBeGreaterThanOrEqual(240)
      expect(p.pill).toEqual({ x: p.x + 8, y: p.y - 12 })
    }
    expect(plan.height).toBeGreaterThanOrEqual(Z1.gotHeadBottom + HUG_PAD)
  })

  it('shows 3 + "+N more" past capacity 4', () => {
    const plan = planSheet('got-wide', many(6))
    expect(plan.places).toHaveLength(3)
    expect(plan.hidden).toBe(3)
    expect(plan.more).not.toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import {
  OG,
  fitName,
  imageAspect,
  ogContent,
  ogSvg,
  planOg,
  turnedBounds,
} from './og-layout'
import type { PublicWishlist } from '#/lib/wishlist/types'

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    aspect: i % 2 ? 0.6 : 2.2,
  }))

const turned = (place: ReturnType<typeof planOg>['places'][number]) =>
  turnedBounds(place)

/** r4: every turned sticker box sits inside the inset and between the zones. */
function expectClear(plan: ReturnType<typeof planOg>) {
  for (const place of plan.places) {
    const box = turned(place)
    expect(box.x).toBeGreaterThanOrEqual(OG.inset - 0.01)
    expect(box.x + box.w).toBeLessThanOrEqual(OG.panel.w - OG.inset + 0.01)
    expect(box.y).toBeGreaterThanOrEqual(OG.zone.top - 0.01)
    expect(box.y + box.h).toBeLessThanOrEqual(OG.zone.bottom + 0.01)
  }
  if (plan.more) {
    expect(plan.more.y).toBeGreaterThanOrEqual(OG.zone.top)
    expect(plan.more.y + plan.more.size).toBeLessThanOrEqual(OG.zone.bottom)
  }
}

type Rect = { x: number; y: number; w: number; h: number }

/** Distance between two boxes (0 when they touch or overlap). */
function gap(a: Rect, b: Rect) {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w))
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h))
  return Math.hypot(dx, dy)
}

function expectApart(boxes: Array<Rect>) {
  for (let i = 0; i < boxes.length; i += 1)
    for (let j = i + 1; j < boxes.length; j += 1)
      expect(gap(boxes[i], boxes[j])).toBeGreaterThan(0)
}

describe('planOg (r4 layouts by count + §4 count rule)', () => {
  it('zones: header 112 and footer 44 of the 550 panel', () => {
    expect(OG.zone).toEqual({ top: 112, bottom: 506 })
  })

  it('1 sticker: centred in the panel at 70% width, turned −4°', () => {
    const plan = planOg([{ id: 'a', aspect: 2.2 }])
    expect(plan.places).toHaveLength(1)
    const [one] = plan.places
    expect(one.w).toBeCloseTo(OG.panel.w * 0.7)
    expect(one.w / one.h).toBeCloseTo(2.2)
    expect(one.rotate).toBe(-4)
    expect(one.x + one.w / 2).toBeCloseTo(OG.panel.w / 2)
    expect(one.y + one.h / 2).toBeCloseTo((OG.zone.top + OG.zone.bottom) / 2)
    expect(plan.more).toBeNull()
    expectClear(plan)
  })

  it('1 tall sticker fits by height between the zones', () => {
    const plan = planOg([{ id: 't', aspect: 0.5 }])
    const [one] = plan.places
    expect(one.w / one.h).toBeCloseTo(0.5)
    expect(one.w).toBeLessThan(OG.panel.w * 0.7)
    expect(turned(one).h).toBeCloseTo(OG.zone.bottom - OG.zone.top)
    expectClear(plan)
  })

  it('2 stickers: diagonal 52% slots, top-left and bottom-right', () => {
    const plan = planOg([
      { id: 'a', aspect: 2 },
      { id: 'b', aspect: 1.8 },
    ])
    const slot = OG.panel.w * 0.52
    const [tl, br] = plan.places
    const a = turned(tl)
    const b = turned(br)
    // Wide items fill the slot's width, turn included.
    expect(a.w).toBeCloseTo(slot)
    expect(b.w).toBeCloseTo(slot)
    expect(a.x).toBeCloseTo(OG.inset)
    expect(a.y).toBeCloseTo(OG.zone.top)
    expect(b.x + b.w).toBeCloseTo(OG.panel.w - OG.inset)
    expect(b.y + b.h).toBeCloseTo(OG.zone.bottom)
    expect(plan.more).toBeNull()
    expectClear(plan)
  })

  it('2 stickers with a tall one: it fills the full slot height (60% of the zone) and the width follows', () => {
    const aspect = 0.45
    const plan = planOg([
      { id: 'a', aspect },
      { id: 'b', aspect: 1.5 },
    ])
    const slotH = (OG.zone.bottom - OG.zone.top) * 0.6
    const place = plan.places[0]
    expect(place.h).toBeCloseTo(slotH)
    expect(place.w).toBeCloseTo(slotH * aspect)
    const tall = turned(place)
    expect(tall.x).toBeCloseTo(OG.inset)
    expect(tall.y).toBeCloseTo(OG.zone.top)
    expectClear(plan)
  })

  it('2 stickers, tall one bottom-right: fills the slot height, anchored bottom-right', () => {
    const plan = planOg([
      { id: 'a', aspect: 1.5 },
      { id: 'b', aspect: 0.67 },
    ])
    const slotH = (OG.zone.bottom - OG.zone.top) * 0.6
    expect(plan.places[1].h).toBeCloseTo(slotH)
    const b = turned(plan.places[1])
    expect(b.x + b.w).toBeCloseTo(OG.panel.w - OG.inset)
    expect(b.y + b.h).toBeCloseTo(OG.zone.bottom)
    expectClear(plan)
  })

  it('3 stickers: fixed slots TL 44% −4°, TR 40% +5°, bottom-centre 44% −2°', () => {
    const plan = planOg([
      { id: 'a', aspect: 2 },
      { id: 'b', aspect: 2 },
      { id: 'c', aspect: 2 },
    ])
    const [tl, tr, bc] = plan.places
    expect(plan.places.map((place) => place.rotate)).toEqual([-4, 5, -2])
    expect(tl.w).toBeCloseTo(OG.panel.w * 0.44)
    expect(tr.w).toBeCloseTo(OG.panel.w * 0.4)
    expect(bc.w).toBeCloseTo(OG.panel.w * 0.44)
    expect(turned(tl).x).toBeCloseTo(OG.inset)
    expect(turned(tl).y).toBeCloseTo(OG.zone.top)
    const right = turned(tr)
    expect(right.x + right.w).toBeCloseTo(OG.panel.w - OG.inset)
    expect(right.y).toBeCloseTo(OG.zone.top)
    expect(bc.x + bc.w / 2).toBeCloseTo(OG.panel.w / 2)
    const bottom = turned(bc)
    expect(bottom.y + bottom.h).toBeCloseTo(OG.zone.bottom)
    expect(plan.more).toBeNull()
    expect(plan.hidden).toBe(0)
    expectApart(plan.places.map(turned))
    expectClear(plan)
  })

  it('3 tall stickers fit by height in their rows', () => {
    const plan = planOg(ids(3).map((item) => ({ ...item, aspect: 0.5 })))
    const [tl, , bc] = plan.places.map(turned)
    expect(tl.h).toBeCloseTo(OG.row.top)
    expect(bc.h).toBeCloseTo(
      OG.zone.bottom - OG.zone.top - OG.row.top - OG.row.gap,
    )
    expectApart(plan.places.map(turned))
    expectClear(plan)
  })

  it('4+ (6): "+N" is 88 across, bottom-right, 16px clear of every sticker', () => {
    for (const list of [
      ids(6),
      ids(6).map((item) => ({ ...item, aspect: 1 })),
    ]) {
      const plan = planOg(list)
      expect(plan.places).toHaveLength(3)
      expect(plan.hidden).toBe(3)
      const more = plan.more!
      expect(more.size).toBe(88)
      expect(more.x + more.size).toBe(OG.panel.w - OG.inset)
      expect(more.y + more.size).toBe(OG.zone.bottom)
      const dot = { x: more.x, y: more.y, w: more.size, h: more.size }
      for (const place of plan.places)
        expect(gap(turned(place), dot)).toBeGreaterThanOrEqual(16)
      expectClear(plan)
    }
  })

  it('keeps the aspect for every count', () => {
    for (const n of [1, 2, 3, 6]) {
      const list = ids(n)
      planOg(list).places.forEach((place, index) =>
        expect(place.w / place.h).toBeCloseTo(list[index].aspect),
      )
    }
  })
})

describe('ogSvg', () => {
  const base = {
    name: 'Sean <Motanya>',
    username: 'sean',
    avatar: null,
    countLine: '15 stickers · 5 sheets',
    fill: 'green' as const,
    tag: '#fits',
    stickers: [
      {
        id: 'a',
        title: 'A',
        kind: 'die' as const,
        src: 'data:image/png;base64,AA',
        aspect: 2,
      },
      {
        id: 'b',
        title: 'B',
        kind: 'photo' as const,
        src: 'data:image/png;base64,AA',
        aspect: 1,
      },
      { id: 'c', title: 'C', kind: 'none' as const, src: null, aspect: null },
      { id: 'd', title: 'D', kind: 'none' as const, src: null, aspect: null },
    ],
  }

  it('is 1200×630 with the 560×550 r30 panel and no filters', () => {
    const svg = ogSvg(base)
    expect(svg).toContain('width="1200" height="630"')
    expect(svg).toContain('x="600" y="40" width="560" height="550" rx="30"')
    expect(svg).not.toMatch(/<filter|feDropShadow/)
  })

  it('escapes text, upper-cases the tag and draws "+1"', () => {
    const svg = ogSvg(base)
    expect(svg).toContain('Sean &lt;Motanya&gt;')
    expect(svg).toContain('#FITS')
    expect(svg).toContain('+1')
  })

  it('never draws a price', () => {
    expect(ogSvg(base)).not.toMatch(/\$\d|KES|USD/)
  })

  it('r5: white sheets get the #EFEFF0 panel, coloured sheets keep theirs', () => {
    expect(ogSvg({ ...base, fill: 'white' })).toContain(
      'rx="30" fill="#EFEFF0"',
    )
    expect(ogSvg(base)).toContain('rx="30" fill="#1FA45A"')
  })

  it('photo stickers get the 7px white frame', () => {
    expect(ogSvg(base)).toMatch(/<image x="7" y="7"/)
  })

  it('shrinks then ellipsizes long names inside the 460 text zone', () => {
    expect(fitName('Sean Motanya').size).toBe(66)
    const long = fitName('Bartholomew Oyelaran-Kimathi the Third')
    expect(long.size).toBe(44)
    expect(long.text.endsWith('…')).toBe(true)
  })
})

describe('ogContent', () => {
  const sticker = (
    id: string,
    categoryId: string | null,
    status: 'unresolved' | 'purchased' = 'unresolved',
  ) => ({
    id,
    title: id,
    brand: '',
    imageUrl: null,
    sourceUrl: '',
    categoryId,
    position: null,
    status,
    purchasedAt: status === 'purchased' ? 1 : null,
    price: { amount: 1000, currency: 'USD' },
    createdAt: 1,
    claimed: false,
    claimedByMe: false,
  })
  const profile: PublicWishlist = {
    username: 'sean',
    name: 'Sean',
    image: null,
    imageVersion: 'v',
    showPrices: true,
    allowClaims: true,
    categories: [
      { id: 'fits', name: 'fits', color: 'green', createdAt: 1 },
      { id: 'home', name: 'home', color: null, createdAt: 2 },
      { id: 'empty', name: 'empty', color: null, createdAt: 3 },
    ],
    items: [
      sticker('a', 'fits'),
      sticker('b', 'fits', 'purchased'),
      sticker('c', 'home'),
      sticker('d', 'home'),
    ],
  }

  it('whole list: first filled sheet, C98 count line over wanted stickers', () => {
    const content = ogContent(profile, null)!
    expect(content.tag).toBe('#fits')
    expect(content.fill).toBe('green')
    expect(content.stickers.map((item) => item.id)).toEqual(['a'])
    expect(content.countLine).toBe('3 stickers · 2 sheets')
  })

  it('?sheet= picks that sheet; unknown or empty sheets give null', () => {
    expect(ogContent(profile, 'home')!.stickers).toHaveLength(2)
    expect(ogContent(profile, 'empty')).toBeNull()
    expect(ogContent(profile, 'nope')).toBeNull()
    expect(ogContent({ ...profile, items: [] }, null)).toBeNull()
  })
})

describe('imageAspect', () => {
  it('reads PNG and JPEG headers', () => {
    const png = new Uint8Array(24)
    png.set([0x89, 0x50, 0x4e, 0x47])
    new DataView(png.buffer).setUint32(16, 300)
    new DataView(png.buffer).setUint32(20, 150)
    expect(imageAspect(png)).toBe(2)
    const jpg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0, 0, 0,
    ])
    expect(imageAspect(jpg)).toBe(2)
    expect(imageAspect(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})

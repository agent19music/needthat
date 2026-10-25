import { describe, expect, it } from 'vitest'
import { category, item } from '../../../test/fixtures'
import {
  BOX_RATIO,
  GOT_PAGE_SIZE,
  NEW_WINDOW_MS,
  ROTATION,
  SHEET_CYCLE,
  buildSheets,
  clampPage,
  cycleColor,
  dayMonth,
  dotFill,
  dotRotation,
  gotCountLabel,
  gotLabel,
  gotSubCaption,
  isNew,
  isTagColor,
  layoutSheet,
  moreLabel,
  nextTagColor,
  overlapRatio,
  pageOf,
  paginateGot,
  seeded,
  sheetKicker,
  sheetMeta,
  stickerKind,
  stickerLabel,
  stickerRotation,
  tagColors,
} from './sheets'
import type { GuestCategory } from '#/lib/guest-wishlist'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 25, 9, 0, 0)
const usd = (dollars: number) => ({ amount: dollars * 100, currency: 'USD' })
const tag = (
  name: string,
  createdAt: number,
  color?: GuestCategory['color'],
): GuestCategory => ({ id: `cat-${name}`, name, createdAt, color })

describe('tag colour', () => {
  it('cycles blue → green → red and wraps, including negatives', () => {
    expect(SHEET_CYCLE).toEqual(['blue', 'green', 'red'])
    expect([0, 1, 2, 3, 4, 5].map(cycleColor)).toEqual([
      'blue',
      'green',
      'red',
      'blue',
      'green',
      'red',
    ])
    expect(cycleColor(-1)).toBe('red')
  })

  it('never hands yellow to a user tag (yellow is Got only)', () => {
    for (let index = 0; index < 30; index += 1)
      expect(cycleColor(index)).not.toBe('yellow')
    expect(isTagColor('yellow')).toBe(false)
    expect(isTagColor('blue')).toBe(true)
    expect(isTagColor(null)).toBe(false)
  })

  it('follows creation order, not the order rows arrive in', () => {
    const colors = tagColors([tag('c', 30), tag('a', 10), tag('b', 20)])
    expect(colors.get('cat-a')).toBe('blue')
    expect(colors.get('cat-b')).toBe('green')
    expect(colors.get('cat-c')).toBe('red')
  })

  it('breaks createdAt ties by id', () => {
    const colors = tagColors([tag('z', 5), tag('m', 5)])
    expect(colors.get('cat-m')).toBe('blue')
    expect(colors.get('cat-z')).toBe('green')
  })

  it('keeps a stored colour and fills the rest from their cycle slot', () => {
    const colors = tagColors([tag('a', 1, 'red'), tag('b', 2), tag('c', 3)])
    expect(colors.get('cat-a')).toBe('red')
    expect(colors.get('cat-b')).toBe('green')
    expect(colors.get('cat-c')).toBe('red')
  })

  it('ignores garbage stored values', () => {
    const bad = { ...tag('a', 1), color: 'yellow' } as unknown as GuestCategory
    expect(tagColors([bad]).get('cat-a')).toBe('blue')
  })

  it('gives a new tag the next cycle slot', () => {
    expect(nextTagColor([])).toBe('blue')
    expect(nextTagColor([tag('a', 1)])).toBe('green')
    expect(nextTagColor([tag('a', 1), tag('b', 2)])).toBe('red')
    expect(nextTagColor([tag('a', 1), tag('b', 2), tag('c', 3)])).toBe('blue')
  })

  it('never puts a price dot on its own sheet colour', () => {
    for (const sheet of ['blue', 'green', 'red', 'yellow', 'blank'] as const) {
      for (let index = 0; index < 50; index += 1) {
        const fill = dotFill(`item-${index}`, sheet)
        if (sheet !== 'blank') expect(fill).not.toBe(sheet)
        expect(['yellow', 'red', 'blue']).toContain(fill)
      }
    }
  })
})

describe('NEW window (Bau Q5: added in the last 7 days)', () => {
  it('is new right after adding and until just before 7 days', () => {
    expect(isNew(item({ createdAt: NOW }), NOW)).toBe(true)
    expect(isNew(item({ createdAt: NOW - 3 * DAY }), NOW)).toBe(true)
    expect(isNew(item({ createdAt: NOW - NEW_WINDOW_MS + 1 }), NOW)).toBe(true)
  })

  it('stops at exactly 7 days and after', () => {
    expect(NEW_WINDOW_MS).toBe(7 * DAY)
    expect(isNew(item({ createdAt: NOW - NEW_WINDOW_MS }), NOW)).toBe(false)
    expect(isNew(item({ createdAt: NOW - 30 * DAY }), NOW)).toBe(false)
  })

  it('tolerates a little clock skew but not far-future rows', () => {
    expect(isNew(item({ createdAt: NOW + 30_000 }), NOW)).toBe(true)
    expect(isNew(item({ createdAt: NOW + DAY }), NOW)).toBe(false)
  })

  it('never marks a got sticker as new', () => {
    expect(
      isNew(
        item({ createdAt: NOW, status: 'purchased', purchasedAt: NOW }),
        NOW,
      ),
    ).toBe(false)
  })
})

describe('seeded rotation', () => {
  const ids = Array.from({ length: 400 }, (_, index) => `id-${index}`)

  it('is stable per id', () => {
    expect(stickerRotation('abc')).toBe(stickerRotation('abc'))
    expect(seeded('abc', 'x')).toBe(seeded('abc', 'x'))
    expect(seeded('abc', 'x')).not.toBe(seeded('abc', 'y'))
  })

  it('rests at ±2..6° and never 0', () => {
    const values = ids.map(stickerRotation)
    for (const value of values) {
      expect(Math.abs(value)).toBeGreaterThanOrEqual(ROTATION.stickerMin)
      expect(Math.abs(value)).toBeLessThanOrEqual(ROTATION.stickerMax)
    }
    expect(values.some((value) => value < 0)).toBe(true)
    expect(values.some((value) => value > 0)).toBe(true)
  })

  it('tilts dots within −10..14°', () => {
    for (const id of ids) {
      expect(dotRotation(id)).toBeGreaterThanOrEqual(-10)
      expect(dotRotation(id)).toBeLessThanOrEqual(14)
    }
  })

  it('seeds into [0, 1)', () => {
    for (const id of ids) {
      expect(seeded(id)).toBeGreaterThanOrEqual(0)
      expect(seeded(id)).toBeLessThan(1)
    }
  })
})

describe('buildSheets', () => {
  it('puts every item on one #all sheet when there are no tags', () => {
    const a = item()
    const b = item({ status: 'purchased', purchasedAt: 5 })
    const set = buildSheets([a, b], [])
    expect(set.filled).toHaveLength(1)
    expect(set.filled[0]).toMatchObject({
      tag: '#all',
      categoryId: null,
      color: 'blue',
      number: 1,
      gotCount: 1,
    })
    expect(set.filled[0].wanted.map((entry) => entry.id)).toEqual([a.id])
    expect(set.got.items.map((entry) => entry.id)).toEqual([b.id])
  })

  it('returns no sheets for an empty list', () => {
    const set = buildSheets([], [])
    expect(set.filled).toEqual([])
    expect(set.blank).toEqual([])
    expect(set.got.count).toBe(0)
  })

  it('splits filled and blank tags and numbers them in creation order', () => {
    const fits = category('fits', 'cat-1')
    const desk = category('desk', 'cat-0')
    const gifts = category('gifts', 'cat-2')
    const a = item({ categoryId: 'cat-1' })
    const b = item({ categoryId: 'cat-0' })
    const set = buildSheets([a, b], [fits, gifts, desk])
    expect(
      set.filled.map((sheet) => [sheet.tag, sheet.number, sheet.color]),
    ).toEqual([
      ['#desk', 1, 'blue'],
      ['#fits', 2, 'green'],
    ])
    expect(
      set.blank.map((sheet) => [sheet.tag, sheet.number, sheet.color]),
    ).toEqual([['#gifts', 3, 'red']])
  })

  it('keeps got stickers on their sheet as ghosts, in manual order', () => {
    const fits = category('fits')
    const a = item({ categoryId: fits.id, position: 2 })
    const b = item({
      categoryId: fits.id,
      position: 0,
      status: 'purchased',
      purchasedAt: 9,
    })
    const c = item({ categoryId: fits.id, position: 1, price: usd(100) })
    const [sheet] = buildSheets([a, b, c], [fits]).filled
    expect(sheet.stickers.map((entry) => entry.id)).toEqual([b.id, c.id, a.id])
    expect(sheet.wanted.map((entry) => entry.id)).toEqual([c.id, a.id])
    expect(sheet.gotCount).toBe(1)
    expect(sheet.total).toBe('$100')
  })

  it('totals only wanted stickers and hides mixed currencies', () => {
    const fits = category('fits')
    const set = buildSheets(
      [
        item({ categoryId: fits.id, price: usd(100) }),
        item({ categoryId: fits.id, price: usd(300) }),
        item({
          categoryId: fits.id,
          price: usd(999),
          status: 'purchased',
          purchasedAt: 1,
        }),
      ],
      [fits],
    )
    expect(set.filled[0].total).toBe('$400')
    const mixed = buildSheets(
      [
        item({ categoryId: fits.id, price: usd(1) }),
        item({ categoryId: fits.id, price: { amount: 100, currency: 'EUR' } }),
      ],
      [fits],
    )
    expect(mixed.filled[0].total).toBeNull()
  })

  it('collects untagged and orphaned items on an #unsorted sheet after the tags', () => {
    const fits = category('fits')
    const loose = item()
    const orphan = item({ categoryId: 'gone' })
    const set = buildSheets(
      [item({ categoryId: fits.id }), loose, orphan],
      [fits],
    )
    const last = set.filled.at(-1)
    expect(last).toMatchObject({
      tag: '#unsorted',
      categoryId: null,
      number: 2,
    })
    expect(last?.color).toBe('green')
    expect(last?.stickers.map((entry) => entry.id).sort()).toEqual(
      [loose.id, orphan.id].sort(),
    )
  })

  it('orders the Got sheet newest first and totals it', () => {
    const old = item({ status: 'purchased', purchasedAt: 100, price: usd(5) })
    const fresh = item({ status: 'purchased', purchasedAt: 900, price: usd(7) })
    const legacy = item({
      status: 'purchased',
      purchasedAt: null,
      updatedAt: 500,
    })
    const set = buildSheets([old, fresh, legacy], [])
    expect(set.got.items.map((entry) => entry.id)).toEqual([
      fresh.id,
      legacy.id,
      old.id,
    ])
    expect(set.got.total).toBe('$12')
  })
})

describe('copy helpers', () => {
  it('formats kickers and meta', () => {
    expect(sheetKicker(2)).toBe('SHEET 02')
    expect(sheetKicker(12)).toBe('SHEET 12')
    expect(sheetMeta(4, '$400')).toBe('4 stickers · $400')
    expect(sheetMeta(1, null)).toBe('1 sticker')
    expect(sheetMeta(0, null)).toBe('0 stickers')
  })

  it('writes the compact 390 meta', () => {
    expect(sheetMeta(4, '$400', { compact: true })).toBe('4 · $400')
    expect(sheetMeta(1, null, { compact: true })).toBe('1')
  })

  it('stamps got dates as dd.mm', () => {
    const date = new Date(2026, 9, 4, 12).getTime()
    expect(dayMonth(date)).toBe('04.10')
    expect(gotLabel(date)).toBe('GOT 04.10')
  })

  it('writes the Got page sub-caption', () => {
    const fits = category('fits')
    const got = item({
      categoryId: fits.id,
      status: 'purchased',
      purchasedAt: 1,
    })
    const items = [
      got,
      item({ categoryId: fits.id, status: 'purchased', purchasedAt: 2 }),
      item({ categoryId: fits.id }),
      item({ categoryId: fits.id }),
    ]
    expect(gotSubCaption(got, items, [fits], { newest: true })).toBe(
      '#fits · 2 of 4 got',
    )
    expect(gotSubCaption(item(), items, [fits], { newest: true })).toBeNull()
  })

  it('adds what is left on the sheet for the newest sticker', () => {
    const fits = category('fits')
    const got = item({
      categoryId: fits.id,
      status: 'purchased',
      purchasedAt: 5,
      price: usd(100),
    })
    const items = [
      got,
      item({
        categoryId: fits.id,
        status: 'purchased',
        purchasedAt: 2,
        price: usd(100),
      }),
      item({ categoryId: fits.id, price: usd(100) }),
      item({ categoryId: fits.id, price: usd(100) }),
    ]
    expect(gotSubCaption(got, items, [fits], { newest: true })).toBe(
      '#fits · 2 of 4 got · $200 left',
    )
    expect(
      gotSubCaption(got, items, [fits], { newest: true, showPrice: false }),
    ).toBe('#fits · 2 of 4 got')
  })

  it('gives older got stickers their tag and price', () => {
    const fits = category('fits')
    const old = item({
      categoryId: fits.id,
      status: 'purchased',
      purchasedAt: 1,
      price: { amount: 10000, currency: 'USD' },
    })
    expect(gotSubCaption(old, [old], [fits])).toBe('#fits · $100')
    expect(gotSubCaption(old, [old], [fits], { showPrice: false })).toBe(
      '#fits',
    )
    expect(gotSubCaption(item({ status: 'purchased' }), [], [])).toBeNull()
    expect(
      gotSubCaption(
        item({ status: 'purchased', price: { amount: 8500, currency: 'USD' } }),
        [],
        [],
      ),
    ).toBe('$85')
  })

  it('says "this year" only when every got date is this year', () => {
    const thisYear = new Date(2026, 1, 1).getTime()
    const lastYear = new Date(2025, 1, 1).getTime()
    const a = item({ status: 'purchased', purchasedAt: thisYear })
    const b = item({ status: 'purchased', purchasedAt: lastYear })
    expect(gotCountLabel([a], NOW)).toBe('1 this year')
    expect(gotCountLabel([a, b], NOW)).toBe('2 stickers')
    expect(gotCountLabel([], NOW)).toBe('0 stickers')
  })

  it('names a sticker for screen readers', () => {
    const fresh = item({
      title: 'Samba OG',
      brand: 'Adidas',
      price: usd(100),
      createdAt: NOW,
    })
    expect(stickerLabel(fresh, { now: NOW })).toBe(
      'Samba OG, Adidas, $100, new',
    )
    expect(stickerLabel(fresh, { now: NOW, showPrice: false })).toBe(
      'Samba OG, Adidas, new',
    )
    const got = item({
      title: 'Chair',
      status: 'purchased',
      purchasedAt: new Date(2026, 8, 2, 12).getTime(),
    })
    expect(stickerLabel(got, { now: NOW })).toBe('Chair, got 02.09')
  })

  it('only shows a more pill when something is hidden', () => {
    expect(moreLabel(0)).toBeNull()
    expect(moreLabel(3)).toBe('+3')
  })
})

describe('Got paging (Bau Q13)', () => {
  const got = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      item({ status: 'purchased', purchasedAt: 1000 + index }),
    )

  it('uses 6 per page on mobile and 12 on desktop', () => {
    expect(GOT_PAGE_SIZE).toEqual({ mobile: 6, desktop: 12 })
  })

  it('always has one page, even when empty', () => {
    expect(paginateGot([], 6)).toEqual([{ index: 0, items: [] }])
  })

  it('pages newest first with a short last page', () => {
    const items = got(14)
    const pages = paginateGot(items, 6)
    expect(pages.map((page) => page.items.length)).toEqual([6, 6, 2])
    expect(pages.map((page) => page.index)).toEqual([0, 1, 2])
    expect(pages[0].items[0].purchasedAt).toBe(1013)
    expect(pages[2].items.at(-1)?.purchasedAt).toBe(1000)
  })

  it('fills exact pages without an empty trailer', () => {
    expect(paginateGot(got(12), 12)).toHaveLength(1)
    expect(paginateGot(got(12), 6)).toHaveLength(2)
  })

  it('skips wanted items and treats bad page sizes as 1', () => {
    const items = [...got(2), item()]
    expect(paginateGot(items, 6)[0].items).toHaveLength(2)
    expect(paginateGot(items, 0)).toHaveLength(2)
    expect(paginateGot(items, Number.NaN)).toHaveLength(2)
  })

  it('clamps pages and finds the page of an item', () => {
    expect(clampPage(5, 3)).toBe(2)
    expect(clampPage(-1, 3)).toBe(0)
    expect(clampPage(Number.NaN, 3)).toBe(0)
    expect(clampPage(0, 0)).toBe(0)
    const pages = paginateGot(got(8), 3)
    const target = pages[2].items[0]
    expect(pageOf(pages, target.id)).toBe(2)
    expect(pageOf(pages, 'missing')).toBe(0)
  })
})

describe('layoutSheet', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      item({ createdAt: 1000 + index }),
    )

  it('shows everything on the 390 column and grows with content', () => {
    const two = layoutSheet(many(2), 'column')
    const six = layoutSheet(many(6), 'column')
    expect(six.slots).toHaveLength(6)
    expect(six.hidden).toBe(0)
    expect(six.height).toBeGreaterThan(two.height)
  })

  it('zig-zags two columns on 390', () => {
    const { slots } = layoutSheet(many(4), 'column')
    expect(slots[0].x).toBeGreaterThan(slots[1].x)
    expect(slots[2].x).toBeGreaterThan(slots[3].x)
    for (let index = 1; index < slots.length; index += 1)
      expect(slots[index].y).toBeGreaterThan(slots[index - 1].y)
  })

  it('caps desktop sheets and reports the rest for "+N more"', () => {
    expect(layoutSheet(many(6), 'wide')).toMatchObject({ hidden: 3 })
    expect(layoutSheet(many(6), 'half')).toMatchObject({ hidden: 2 })
    expect(layoutSheet(many(3), 'got')).toMatchObject({ hidden: 1 })
    expect(layoutSheet(many(2), 'half').hidden).toBe(0)
  })

  it('keeps every sticker inside the sheet width', () => {
    for (const variant of [
      'column',
      'wide',
      'half',
      'got',
      'page',
      'wall',
    ] as const) {
      for (const slot of layoutSheet(many(8), variant).slots) {
        expect(slot.x).toBeGreaterThan(0)
        expect(slot.x + slot.size).toBeLessThan(1)
        expect(slot.y).toBeGreaterThan(0)
      }
    }
  })

  it('keeps neighbours to at most ~15% overlap', () => {
    for (const variant of [
      'column',
      'wide',
      'half',
      'got',
      'page',
      'wall',
    ] as const) {
      const { slots } = layoutSheet(many(8), variant)
      for (let index = 1; index < slots.length; index += 1)
        expect(
          overlapRatio(slots[index - 1], slots[index]),
        ).toBeLessThanOrEqual(0.2)
    }
  })

  it('stacks newest on top and is deterministic', () => {
    const items = many(4)
    const { slots } = layoutSheet(items, 'half')
    expect(slots.at(-1)?.z).toBe(4)
    expect(slots[0].z).toBe(1)
    expect(layoutSheet(items, 'half')).toEqual(layoutSheet(items, 'half'))
  })

  it('opens a full desktop sheet as rows of five that grow', () => {
    const twelve = layoutSheet(many(12), 'wall')
    expect(twelve.hidden).toBe(0)
    expect(twelve.slots).toHaveLength(12)
    expect(twelve.slots[5].y).toBeGreaterThan(twelve.slots[0].y + 0.2)
    expect(twelve.height).toBeGreaterThan(layoutSheet(many(5), 'wall').height)
  })

  it('prints the newest got sticker larger on the Got page', () => {
    const page = layoutSheet(many(5), 'page')
    const [first, ...rest] = page.slots
    expect(first.size).toBeGreaterThan(rest[0].size)
    expect(new Set(rest.map((slot) => slot.size)).size).toBe(1)
  })

  it('uses 4:3 sticker boxes', () => {
    expect(BOX_RATIO).toBe(0.75)
  })
})

describe('stickerKind', () => {
  it('maps image keys to the right sticker treatment', () => {
    expect(stickerKind('/api/images/d-abc-1')).toBe('die')
    expect(stickerKind('/api/images/c-abc-v5')).toBe('cutout')
    expect(stickerKind('/api/images/o-abc')).toBe('photo')
    expect(stickerKind('https://shop.example/a.jpg')).toBe('photo')
    expect(stickerKind(null)).toBe('none')
    expect(stickerKind('')).toBe('none')
  })
})

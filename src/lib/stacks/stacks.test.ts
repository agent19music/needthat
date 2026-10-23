import { describe, expect, it } from 'vitest'
import { category, item } from '../../../test/fixtures'
import {
  PILE_FAN,
  PILE_REST,
  buildPiles,
  categoryTag,
  formatPrice,
  formatTotal,
  hostOf,
  orderGot,
  pileAriaLabel,
  pileCardPose,
  slotFromPointer,
  stampText,
  stripAnnouncement,
  stripItems,
  stripPosition,
  stripSlot,
} from './stacks'

describe('stripSlot geometry (handoff values)', () => {
  it('focus card is 340×450, flat, on top', () => {
    expect(stripSlot(0, false)).toMatchObject({
      x: 0,
      rotate: 0,
      scale: 1,
      width: 340,
      height: 450,
      visible: true,
    })
  })
  it('neighbours sit at ±320 rotated ±2° on desktop, ±262 on mobile', () => {
    expect(stripSlot(1, false)).toMatchObject({
      x: 320,
      rotate: 2,
      width: 280,
      height: 380,
    })
    expect(stripSlot(-1, false)).toMatchObject({ x: -320, rotate: -2 })
    expect(stripSlot(1, true).x).toBe(262)
  })
  it('second neighbours at ±560, scale .86, hidden on mobile so nothing clips', () => {
    expect(stripSlot(-2, false)).toMatchObject({
      x: -560,
      rotate: -4,
      scale: 0.86,
      visible: true,
    })
    expect(stripSlot(2, true).visible).toBe(false)
    expect(stripSlot(3, false).visible).toBe(false)
  })
  it('z-order falls off with distance', () => {
    expect(stripSlot(0, false).zIndex).toBeGreaterThan(
      stripSlot(1, false).zIndex,
    )
    expect(stripSlot(1, false).zIndex).toBeGreaterThan(
      stripSlot(2, false).zIndex,
    )
  })
})

describe('pileCardPose', () => {
  it('top card uses the last pose, bottom the first', () => {
    expect(pileCardPose(0, false, false)).toEqual(PILE_REST[2])
    expect(pileCardPose(2, false, false)).toEqual(PILE_REST[0])
    expect(pileCardPose(2, true, false)).toEqual(PILE_FAN[0])
  })
  it('reduced motion never fans', () => {
    expect(pileCardPose(1, true, true)).toEqual(PILE_REST[1])
  })
})

describe('buildPiles', () => {
  const fits = category('Fits')
  const home = category('Home')
  const gifts = category('Gifts')
  it('builds category piles, unsorted, got, then empty categories', () => {
    const a = item({ categoryId: fits.id })
    const b = item({ categoryId: home.id })
    const c = item({ categoryId: null })
    const d = item({ categoryId: fits.id, status: 'purchased', purchasedAt: 5 })
    const piles = buildPiles([a, b, c, d], [fits, home, gifts])
    expect(piles.map((p) => p.kind)).toEqual([
      'category',
      'category',
      'unsorted',
      'got',
      'empty',
    ])
    expect(piles[0]).toMatchObject({ tag: '#fits', count: 1 })
    expect(piles[3]).toMatchObject({ count: 1 })
    expect(piles[4]).toMatchObject({ tag: '#gifts' })
  })
  it('items with a deleted category fall into unsorted', () => {
    const piles = buildPiles([item({ categoryId: 'gone' })], [fits])
    expect(piles.map((p) => p.kind)).toEqual(['unsorted', 'empty'])
  })
  it('orders pile items by manual position', () => {
    const a = item({ categoryId: fits.id, position: 2 })
    const b = item({ categoryId: fits.id, position: 0 })
    const piles = buildPiles([a, b], [fits])
    expect(
      piles[0].kind === 'category' && piles[0].items.map((i) => i.id),
    ).toEqual([b.id, a.id])
  })
  it('total is hidden when nothing has an offer', () => {
    const piles = buildPiles([item({ categoryId: fits.id })], [fits])
    expect(piles[0].kind === 'category' && piles[0].total).toBeNull()
  })
})

describe('stripItems', () => {
  it('wanted first by position, then got newest first', () => {
    const w1 = item({ categoryId: 'c', position: 1 })
    const w0 = item({ categoryId: 'c', position: 0 })
    const g1 = item({ categoryId: 'c', status: 'purchased', purchasedAt: 10 })
    const g2 = item({ categoryId: 'c', status: 'purchased', purchasedAt: 20 })
    const other = item({ categoryId: 'd' })
    expect(stripItems([w1, g1, other, w0, g2], 'c').map((i) => i.id)).toEqual([
      w0.id,
      w1.id,
      g2.id,
      g1.id,
    ])
  })
})

describe('orderGot', () => {
  it('falls back to updatedAt when purchasedAt is missing', () => {
    const a = item({ status: 'purchased', purchasedAt: null, updatedAt: 50 })
    const b = item({ status: 'purchased', purchasedAt: 40 })
    expect(orderGot([b, a]).map((i) => i.id)).toEqual([a.id, b.id])
  })
})

describe('prices', () => {
  it('formats cents, dropping .00', () => {
    expect(formatPrice({ amount: 12000, currency: 'USD' })).toBe('$120')
    expect(formatPrice({ amount: 1299, currency: 'USD' })).toBe('$12.99')
  })
  it('hides a missing or invalid price', () => {
    expect(formatPrice(null)).toBeNull()
    expect(formatPrice(undefined)).toBeNull()
    expect(formatPrice({ amount: 1, currency: 'NOPE!' })).toBeNull()
  })
  it('totals one currency, hides mixed currencies or no offers', () => {
    expect(
      formatTotal([
        item({ price: { amount: 10000, currency: 'USD' } }),
        item({ price: { amount: 30000, currency: 'USD' } }),
        item(),
      ]),
    ).toBe('$400')
    expect(
      formatTotal([
        item({ price: { amount: 1, currency: 'USD' } }),
        item({ price: { amount: 1, currency: 'EUR' } }),
      ]),
    ).toBeNull()
    expect(formatTotal([item(), item()])).toBeNull()
  })
})

describe('labels', () => {
  it('categoryTag', () => {
    expect(categoryTag(' Fits ')).toBe('#fits')
  })
  it('stampText is GOT IT · DD.MM', () => {
    expect(stampText(new Date(2026, 2, 7).getTime())).toBe('GOT IT · 07.03')
  })
  it('pileAriaLabel', () => {
    expect(pileAriaLabel('#fits', 4, '$400')).toBe('#fits, 4 items, $400')
    expect(pileAriaLabel('#fits', 1, null)).toBe('#fits, 1 item')
  })
  it('stripPosition', () => {
    const items = [
      item({ price: { amount: 40000, currency: 'USD' } }),
      item(),
      item({ status: 'purchased' }),
    ]
    expect(stripPosition(1, items)).toBe('2 / 3 · $400 · 1 got')
    expect(stripPosition(0, [item()])).toBe('1 / 1')
    expect(stripPosition(0, [])).toBe('0 / 0')
  })
  it('hostOf', () => {
    expect(hostOf('https://www.adidas.com/x')).toBe('adidas.com')
    expect(hostOf('nope')).toBeNull()
  })
  it('stripAnnouncement', () => {
    expect(stripAnnouncement(item({ title: 'Samba OG' }), 2, 4)).toBe(
      'Samba OG, 3 of 4',
    )
    expect(stripAnnouncement(undefined, 0, 0)).toBe('')
  })
})

describe('slotFromPointer', () => {
  it('picks the nearest slot centre', () => {
    expect(slotFromPointer(0, [50, 200, 350])).toBe(0)
    expect(slotFromPointer(260, [50, 200, 350])).toBe(1)
    expect(slotFromPointer(9999, [50, 200, 350])).toBe(2)
  })
})

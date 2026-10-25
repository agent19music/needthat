import { describe, expect, it } from 'vitest'
import {
  compareByPosition,
  latestPrices,
  moveIndex,
  nextPurchasedAt,
  reassignPositions,
  sortByPosition,
  topPosition,
} from './order'

const row = (id: string, position: number | null, createdAt = 0) => ({
  id,
  position,
  createdAt,
})

describe('compareByPosition / sortByPosition', () => {
  it('orders by position ascending', () => {
    expect(
      sortByPosition([row('b', 2), row('a', 0), row('c', 1)]).map((r) => r.id),
    ).toEqual(['a', 'c', 'b'])
  })
  it('puts unpositioned items after positioned ones, newest first', () => {
    const out = sortByPosition([
      row('old', null, 1),
      row('p', 5),
      row('new', null, 9),
    ])
    expect(out.map((r) => r.id)).toEqual(['p', 'new', 'old'])
  })
  it('treats undefined like null (items saved before Stacks)', () => {
    expect(
      compareByPosition(
        { id: 'a', createdAt: 1 },
        { id: 'b', position: 0, createdAt: 1 },
      ),
    ).toBeGreaterThan(0)
  })
  it('breaks ties by createdAt then id, so the order is total', () => {
    expect(
      sortByPosition([row('b', 1, 5), row('a', 1, 5), row('c', 1, 6)]).map(
        (r) => r.id,
      ),
    ).toEqual(['c', 'a', 'b'])
  })
  it('does not mutate the input', () => {
    const input = [row('b', 1), row('a', 0)]
    sortByPosition(input)
    expect(input[0].id).toBe('b')
  })
})

describe('topPosition', () => {
  it('is 0 for an empty list or one with no positions', () => {
    expect(topPosition([])).toBe(0)
    expect(topPosition([null, null])).toBe(0)
  })
  it('is one less than the smallest position', () => {
    expect(topPosition([3, null, 1, 7])).toBe(0)
    expect(topPosition([-2, 4])).toBe(-3)
  })
})

describe('reassignPositions', () => {
  const all = [row('a', 0), row('x', 1), row('b', 2), row('c', 3)]
  it('reorders only the given ids inside the global order', () => {
    // stack = a, b, c (x belongs to another stack and keeps its slot)
    const changes = reassignPositions(all, ['c', 'a', 'b'])
    const result = sortByPosition(
      all.map((r) => ({
        ...r,
        position: changes.find((c) => c.id === r.id)?.position ?? r.position,
      })),
    )
    expect(result.map((r) => r.id)).toEqual(['c', 'x', 'a', 'b'])
  })
  it('returns only rows that changed', () => {
    expect(reassignPositions(all, ['a', 'b', 'c'])).toEqual([])
    expect(
      reassignPositions(all, ['b', 'a'])
        .map((c) => c.id)
        .sort(),
    ).toEqual(['a', 'b'])
  })
  it('normalises null positions into 0..n-1', () => {
    const changes = reassignPositions(
      [row('a', null, 2), row('b', null, 1)],
      ['a', 'b'],
    )
    expect(changes).toEqual([
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
    ])
  })
  it('rejects duplicates and unknown ids', () => {
    expect(() => reassignPositions(all, ['a', 'a'])).toThrow()
    expect(() => reassignPositions(all, ['zzz'])).toThrow()
  })
})

describe('moveIndex', () => {
  it('moves and clamps', () => {
    expect(moveIndex([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveIndex([1, 2, 3], 2, -5)).toEqual([3, 1, 2])
    expect(moveIndex([1, 2, 3], 0, 99)).toEqual([2, 3, 1])
  })
})

describe('nextPurchasedAt', () => {
  it('stamps the time on the transition to purchased', () => {
    expect(
      nextPurchasedAt(
        { status: 'unresolved', purchasedAt: null },
        'purchased',
        42,
      ),
    ).toBe(42)
    expect(nextPurchasedAt(null, 'purchased', 42)).toBe(42)
  })
  it('keeps the original time while purchased', () => {
    expect(
      nextPurchasedAt({ status: 'purchased', purchasedAt: 7 }, 'purchased', 42),
    ).toBe(7)
  })
  it('fills a purchased row that predates the column', () => {
    expect(
      nextPurchasedAt(
        { status: 'purchased', purchasedAt: null },
        'purchased',
        42,
      ),
    ).toBe(42)
  })
  it('clears when un-got', () => {
    expect(
      nextPurchasedAt(
        { status: 'purchased', purchasedAt: 7 },
        'unresolved',
        42,
      ),
    ).toBeNull()
  })
})

describe('latestPrices', () => {
  it('keeps the latest priced offer per item and skips incomplete rows', () => {
    const prices = latestPrices([
      { itemId: 'a', priceAmount: 1000, currency: 'USD', observedAt: 1 },
      { itemId: 'a', priceAmount: 1200, currency: 'USD', observedAt: 5 },
      { itemId: 'b', priceAmount: null, currency: 'USD', observedAt: 9 },
      { itemId: null, priceAmount: 1, currency: 'USD', observedAt: 9 },
      { itemId: 'c', priceAmount: 500, currency: null, observedAt: 9 },
    ])
    expect(prices.get('a')).toEqual({ amount: 1200, currency: 'USD' })
    expect(prices.has('b')).toBe(false)
    expect(prices.has('c')).toBe(false)
  })
})

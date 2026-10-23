// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../../../test/sqlite-db'
import type { DatabaseSync } from 'node:sqlite'

interface TestState {
  db: unknown
  sqlite: DatabaseSync | null
  session: { user: { id: string } } | null
}

const state = vi.hoisted<TestState>(() => ({
  db: null,
  sqlite: null,
  session: { user: { id: 'u1' } },
}))

vi.mock('#/db/index', () => ({
  getDb: () => state.db,
  getImageBucket: () => null,
}))
vi.mock('#/lib/session.server', () => ({
  readSession: async () => state.session,
}))
vi.mock('#/lib/og/card.server', () => ({ warmShareCardForUser: () => {} }))
vi.mock('#/lib/images/store-image.server', () => ({
  decodeImageBase64: () => null,
  putImageObject: async () => null,
}))
vi.mock('@sentry/tanstackstart-react', () => ({
  startSpan: (_: unknown, run: () => unknown) => run(),
}))

const {
  readAccountWishlist,
  reorderAccountItems,
  writeAccountItem,
  writeAccountCategory,
} = await import('./account.server')

let clock = 1_700_000_000_000
function input(id: string, overrides: Record<string, unknown> = {}) {
  clock += 1000
  return {
    id,
    title: `Item ${id}`,
    brand: '',
    notes: '',
    sourceUrl: '',
    categoryId: null,
    status: 'unresolved' as const,
    imageUrl: null,
    createdAt: clock,
    updatedAt: clock,
    ...overrides,
  }
}

async function ids() {
  const result = await readAccountWishlist()
  if (!result.ok) throw new Error(result.message)
  return result.items.map((item) => item.id)
}

beforeEach(() => {
  const created = createTestDb()
  state.db = created.db
  state.sqlite = created.sqlite
  state.session = { user: { id: 'u1' } }
})

describe('account wishlist API: positions', () => {
  it('new items land on top of the pile', async () => {
    await writeAccountItem(input('a'))
    await writeAccountItem(input('b'))
    await writeAccountItem(input('c'))
    expect(await ids()).toEqual(['c', 'b', 'a'])
  })

  it('editing an item keeps its place', async () => {
    await writeAccountItem(input('a'))
    await writeAccountItem(input('b'))
    await writeAccountItem({ ...input('a'), title: 'renamed' })
    expect(await ids()).toEqual(['b', 'a'])
  })

  it('moving an item to another stack puts it on top', async () => {
    await writeAccountCategory({ id: 'cat1', name: 'Fits', createdAt: 1 })
    await writeAccountItem(input('a'))
    await writeAccountItem(input('b'))
    await writeAccountItem({ ...input('a'), categoryId: 'cat1' })
    expect(await ids()).toEqual(['a', 'b'])
  })

  it('reorder saves the new order and leaves other stacks alone', async () => {
    for (const id of ['a', 'b', 'c', 'd']) await writeAccountItem(input(id))
    // order now d, c, b, a; reorder the subset [d, b] → [b, d]
    const result = await reorderAccountItems(['b', 'd'])
    expect(result).toMatchObject({ ok: true })
    expect(await ids()).toEqual(['b', 'c', 'd', 'a'])
  })

  it('reorder is idempotent', async () => {
    for (const id of ['a', 'b']) await writeAccountItem(input(id))
    await reorderAccountItems(['a', 'b'])
    expect(await reorderAccountItems(['a', 'b'])).toEqual({
      ok: true,
      changed: 0,
    })
  })

  it('reorder rejects unknown, duplicate, malformed and empty ids', async () => {
    await writeAccountItem(input('a'))
    for (const bad of [['zzz'], ['a', 'a'], ['a; drop'], []]) {
      expect(await reorderAccountItems(bad)).toMatchObject({ ok: false })
    }
  })

  it("reorder cannot touch another user's items", async () => {
    await writeAccountItem(input('mine'))
    state.session = { user: { id: 'u2' } }
    await writeAccountItem(input('theirs'))
    expect(await reorderAccountItems(['mine', 'theirs'])).toMatchObject({
      ok: false,
    })
    state.session = { user: { id: 'u1' } }
    expect(await ids()).toEqual(['mine'])
  })

  it('reorder needs a session', async () => {
    state.session = null
    expect(await reorderAccountItems(['a'])).toEqual({
      ok: false,
      message: 'Sign in to arrange this stack.',
    })
  })
})

describe('account wishlist API: got it', () => {
  it('sets purchasedAt on got, keeps it, clears it on want again', async () => {
    await writeAccountItem(input('a'))
    await writeAccountItem({ ...input('a'), status: 'purchased' })
    let item = (
      (await readAccountWishlist()) as {
        items: Array<{ purchasedAt: number | null }>
      }
    ).items[0]
    const first = item.purchasedAt
    expect(first).toEqual(expect.any(Number))
    await writeAccountItem({
      ...input('a'),
      status: 'purchased',
      title: 'edit',
    })
    item = (
      (await readAccountWishlist()) as {
        items: Array<{ purchasedAt: number | null }>
      }
    ).items[0]
    expect(item.purchasedAt).toBe(first)
    await writeAccountItem({ ...input('a'), status: 'unresolved' })
    item = (
      (await readAccountWishlist()) as {
        items: Array<{ purchasedAt: number | null }>
      }
    ).items[0]
    expect(item.purchasedAt).toBeNull()
  })
})

describe('account wishlist API: prices', () => {
  it('price is null without an offer and the latest offer otherwise', async () => {
    await writeAccountItem(input('a'))
    await writeAccountItem(input('b'))
    const sqlite = state.sqlite as DatabaseSync
    const columns = sqlite
      .prepare(`PRAGMA table_info(offers)`)
      .all()
      .map((row) => String(row.name))
    expect(columns).toEqual(
      expect.arrayContaining([
        'item_id',
        'price_amount',
        'currency',
        'observed_at',
      ]),
    )
    const required = sqlite
      .prepare(`PRAGMA table_info(offers)`)
      .all()
      .filter((row) => row.notnull && row.dflt_value === null && !row.pk)
      .map((row) => String(row.name))
    const insert = (id: string, amount: number, at: number) => {
      const values: Record<string, unknown> = {
        id,
        item_id: 'a',
        price_amount: amount,
        currency: 'USD',
        observed_at: at,
      }
      for (const name of required)
        if (!(name in values)) values[name] = name.endsWith('_at') ? at : 'x'
      const keys = Object.keys(values)
      sqlite
        .prepare(
          `INSERT INTO offers (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        )
        .run(...(Object.values(values) as Array<string | number>))
    }
    insert('o1', 1000, 1)
    insert('o2', 1500, 2)
    const result = (await readAccountWishlist()) as {
      items: Array<{ id: string; price: unknown }>
    }
    expect(result.items.find((item) => item.id === 'a')?.price).toEqual({
      amount: 1500,
      currency: 'USD',
    })
    expect(result.items.find((item) => item.id === 'b')?.price).toBeNull()
  })
})

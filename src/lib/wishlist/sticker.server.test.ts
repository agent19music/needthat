// @vitest-environment node
/**
 * Server tests for the Sticker Sheet additions: tag colours, link prices,
 * die images, share toggles, the public sheet and claims.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'

import { createTestDb } from '../../../test/sqlite-db'

interface TestState {
  db: unknown
  sqlite: DatabaseSync | null
  session: { user: { id: string } } | null
}

const state = vi.hoisted<TestState>(() => ({
  db: null,
  sqlite: null,
  session: { user: { id: 'owner' } },
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
  isSafeImageUrl: (value: string) => value.startsWith('https://'),
}))
vi.mock('@sentry/tanstackstart-react', () => ({
  startSpan: (_: unknown, run: () => unknown) => run(),
}))

const account = await import('./account.server')
const publicSheet = await import('./public.server')

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

function addUser(id: string, username: string) {
  state.sqlite!.exec(
    `insert into user (id, name, email, email_verified, username, created_at, updated_at)
     values ('${id}', '${username} name', '${id}@x.test', 1, '${username}', 1, 1)`,
  )
}

function as(id: string | null) {
  state.session = id ? { user: { id } } : null
}

async function wishlist() {
  const result = await account.readAccountWishlist()
  if (!result.ok) throw new Error(result.message)
  return result
}

beforeEach(() => {
  const created = createTestDb()
  state.db = created.db
  state.sqlite = created.sqlite
  addUser('owner', 'sean')
  addUser('friend', 'wanjiru')
  addUser('other', 'otieno')
  as('owner')
})

describe('tag colour', () => {
  it('new tags take the next sheet colour in creation order', async () => {
    for (const [i, id] of ['fits', 'desk', 'football', 'gifts'].entries())
      await account.writeAccountCategory({ id, name: id, createdAt: 10 + i })
    const { categories } = await wishlist()
    expect(categories.map((c) => [c.id, c.color])).toEqual([
      ['fits', 'blue'],
      ['desk', 'green'],
      ['football', 'red'],
      ['gifts', 'white'],
    ])
  })

  it('keeps a chosen colour, and renaming does not change it', async () => {
    const saved = await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      color: 'green',
      createdAt: 10,
    })
    expect(saved).toEqual({ ok: true, color: 'green' })
    await account.writeAccountCategory({
      id: 'fits',
      name: 'outfits',
      createdAt: 10,
    })
    expect((await wishlist()).categories[0]).toMatchObject({
      name: 'outfits',
      color: 'green',
    })
  })

  it('ignores colours that are not on the sheet palette', async () => {
    await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      // @ts-expect-error bad client input
      color: 'yellow',
      createdAt: 10,
    })
    expect((await wishlist()).categories[0].color).toBe('blue')
  })
})

describe('prices from links', () => {
  it('stores the link price as an offer and reads it back', async () => {
    await account.writeAccountItem(
      input('a', {
        sourceUrl: 'https://www.adidas.com/samba-og',
        price: { amount: 10000, currency: 'USD' },
      }),
    )
    expect((await wishlist()).items[0].price).toEqual({
      amount: 10000,
      currency: 'USD',
    })
    const offer = state
      .sqlite!.prepare('select source_name, provider from offers')
      .get()
    expect(offer).toEqual({ source_name: 'adidas.com', provider: 'link' })
  })

  it('keeps one link offer that follows the latest price', async () => {
    const item = input('a', { price: { amount: 10000, currency: 'USD' } })
    await account.writeAccountItem(item)
    await account.writeAccountItem({ ...item })
    await account.writeAccountItem({
      ...item,
      price: { amount: 9000, currency: 'USD' },
    })
    const count = state
      .sqlite!.prepare('select count(*) as n from offers')
      .get() as { n: number }
    expect(count.n).toBe(1)
    expect((await wishlist()).items[0].price?.amount).toBe(9000)
  })

  it('no price keeps the price hidden', async () => {
    await account.writeAccountItem(input('a'))
    expect((await wishlist()).items[0].price).toBeNull()
  })
})

describe('die images', () => {
  it('accepts d- keys and records a die image row', async () => {
    await account.writeAccountItem(
      input('a', { imageUrl: '/api/images/d-a-12345' }),
    )
    expect((await wishlist()).items[0].imageUrl).toBe('/api/images/d-a-12345')
    const rows = state.sqlite!.prepare('select r2_key, role from images').all()
    expect(rows).toEqual([{ r2_key: 'd-a-12345', role: 'die' }])
  })

  it('replaces the die row on a re-cut and skips other images', async () => {
    const item = input('a', { imageUrl: '/api/images/d-a-1' })
    await account.writeAccountItem(item)
    await account.writeAccountItem({ ...item, imageUrl: '/api/images/d-a-2' })
    await account.writeAccountItem(input('b', { imageUrl: '/api/images/o-b' }))
    const rows = state
      .sqlite!.prepare('select item_id, r2_key from images')
      .all()
    expect(rows).toEqual([{ item_id: 'a', r2_key: 'd-a-2' }])
  })

  it('drops unknown image keys', async () => {
    await account.writeAccountItem(input('a', { imageUrl: '/api/images/z-a' }))
    expect((await wishlist()).items[0].imageUrl).toBeNull()
  })
})

const ON = { showPrices: true, allowClaims: true, sharing: true }

describe('share toggles (r7: per sheet)', () => {
  it('every sheet starts with both switches on and sharing on', async () => {
    await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      createdAt: 1,
    })
    expect(await account.readShareSettings()).toEqual({
      ok: true,
      sheets: { '': ON, fits: ON },
      bio: '',
      forLine: '',
    })
  })

  it('saves one sheet without touching the others', async () => {
    await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      createdAt: 1,
    })
    await account.writeAccountCategory({
      id: 'desk',
      name: 'desk',
      createdAt: 2,
    })
    const result = await account.writeShareSettings({
      sheetIds: ['fits'],
      showPrices: false,
    })
    expect(result).toMatchObject({
      ok: true,
      sheets: {
        '': ON,
        fits: { ...ON, showPrices: false },
        desk: ON,
      },
    })
    expect(await account.readShareSettings()).toMatchObject({
      sheets: { fits: { showPrices: false }, desk: { showPrices: true } },
    })
  })

  it('#unsorted keeps its switches on the list row', async () => {
    await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      createdAt: 1,
    })
    await account.writeShareSettings({ sheetIds: [''], allowClaims: false })
    expect(await account.readShareSettings()).toMatchObject({
      sheets: { '': { ...ON, allowClaims: false }, fits: ON },
    })
  })

  it('Share all sheets writes every sheet at once', async () => {
    await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      createdAt: 1,
    })
    await account.writeAccountCategory({
      id: 'desk',
      name: 'desk',
      createdAt: 2,
    })
    await account.writeShareSettings({
      sheetIds: ['', 'fits', 'desk'],
      sharing: false,
    })
    const result = await account.readShareSettings()
    if (!result.ok) throw new Error(result.message)
    expect(Object.values(result.sheets).every((s) => !s.sharing)).toBe(true)
    expect(Object.values(result.sheets).every((s) => s.showPrices)).toBe(true)
  })

  it("ignores another person's sheet ids", async () => {
    as('friend')
    await account.writeAccountCategory({
      id: 'theirs',
      name: 'x',
      createdAt: 1,
    })
    as('owner')
    await account.writeShareSettings({ sheetIds: ['theirs'], sharing: false })
    as('friend')
    expect(await account.readShareSettings()).toMatchObject({
      sheets: { theirs: ON },
    })
  })

  it('an empty patch changes nothing', async () => {
    expect(await account.writeShareSettings({ sheetIds: [''] })).toMatchObject({
      ok: true,
      sheets: { '': ON },
    })
  })

  it('needs a session', async () => {
    as(null)
    expect(
      (await account.writeShareSettings({ sheetIds: [''], showPrices: false }))
        .ok,
    ).toBe(false)
    expect((await account.readShareSettings()).ok).toBe(false)
  })
})

describe('profile bio and FOR line (C11, C12)', () => {
  it('saves, trims, collapses spaces and caps the lengths', async () => {
    const result = await account.writeProfile({
      bio: `  ${'a'.repeat(80)}  `,
      forLine: '  my   big birthday party ',
    })
    expect(result).toEqual({
      ok: true,
      bio: 'a'.repeat(account.BIO_MAX),
      forLine: 'my big birth',
    })
    expect(await account.readShareSettings()).toMatchObject({
      bio: 'a'.repeat(70),
      forLine: 'my big birth',
    })
  })

  it('clears with empty strings and shows on the public page', async () => {
    await account.writeProfile({ bio: 'Coffee and gear', forLine: 'Birthday' })
    expect(await publicSheet.loadPublicWishlist('sean')).toMatchObject({
      bio: 'Coffee and gear',
      forLine: 'Birthday',
    })
    await account.writeProfile({ bio: ' ', forLine: '' })
    expect(await publicSheet.loadPublicWishlist('sean')).toMatchObject({
      bio: '',
      forLine: '',
    })
  })

  it('needs a session', async () => {
    as(null)
    expect((await account.writeProfile({ bio: 'x', forLine: '' })).ok).toBe(
      false,
    )
  })
})

describe('public sheet', () => {
  beforeEach(async () => {
    await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      createdAt: 10,
    })
    await account.writeAccountItem(
      input('want', {
        categoryId: 'fits',
        price: { amount: 8500, currency: 'USD' },
      }),
    )
    await account.writeAccountItem(
      input('got', { categoryId: 'fits', status: 'purchased' }),
    )
  })

  it('shows tags with colours, wanted and got stickers, and prices', async () => {
    const sheet = await publicSheet.loadPublicWishlist('sean')
    expect(sheet?.categories).toEqual([
      {
        id: 'fits',
        name: 'fits',
        color: 'blue',
        createdAt: expect.any(Number),
      },
    ])
    const byId = new Map(sheet!.items.map((item) => [item.id, item]))
    expect(byId.get('want')).toMatchObject({
      categoryId: 'fits',
      status: 'unresolved',
      price: { amount: 8500, currency: 'USD' },
      claimed: false,
    })
    expect(byId.get('got')?.status).toBe('purchased')
    expect(byId.get('got')?.purchasedAt).toEqual(expect.any(Number))
  })

  it('hides prices when the owner turns them off, and changes the image version', async () => {
    const before = await publicSheet.loadPublicWishlist('sean')
    await account.writeShareSettings({ sheetIds: ['fits'], showPrices: false })
    const after = await publicSheet.loadPublicWishlist('sean')
    // #unsorted (empty, still on) keeps the profile-wide flag on.
    expect(after?.sheets.fits.showPrices).toBe(false)
    expect(after?.items.every((item) => item.price === null)).toBe(true)
    expect(after?.imageVersion).not.toBe(before?.imageVersion)
  })

  it('Stop sharing hides that sheet and blocks claims; sharing again restores it', async () => {
    await account.writeShareSettings({ sheetIds: ['fits'], sharing: false })
    const stopped = await publicSheet.loadPublicWishlist('sean')
    expect(stopped).not.toBeNull()
    expect(stopped?.items).toEqual([])
    expect(stopped?.categories).toEqual([])
    expect(stopped?.sheets.fits.sharing).toBe(false)
    expect(
      (await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')).ok,
    ).toBe(false)
    await account.writeShareSettings({ sheetIds: ['fits'], sharing: true })
    expect((await publicSheet.loadPublicWishlist('sean'))?.items).toHaveLength(
      2,
    )
  })

  it('stopping one sheet leaves the others shared', async () => {
    await account.writeAccountCategory({
      id: 'desk',
      name: 'desk',
      createdAt: 20,
    })
    await account.writeAccountItem(input('lamp', { categoryId: 'desk' }))
    await account.writeAccountItem(input('loose'))
    await account.writeShareSettings({ sheetIds: ['fits'], sharing: false })
    const sheet = await publicSheet.loadPublicWishlist('sean')
    expect(sheet?.items.map((item) => item.id).sort()).toEqual([
      'lamp',
      'loose',
    ])
    expect(sheet?.items.every((item) => item.shared)).toBe(true)
    expect(sheet?.categories.map((row) => row.id)).toEqual(['desk'])
  })

  it('Show prices off nulls prices only on that sheet', async () => {
    await account.writeAccountItem(
      input('loose', { price: { amount: 1200, currency: 'USD' } }),
    )
    await account.writeShareSettings({ sheetIds: ['fits'], showPrices: false })
    const sheet = await publicSheet.loadPublicWishlist('sean')
    const byId = new Map(sheet!.items.map((item) => [item.id, item]))
    expect(byId.get('want')?.price).toBeNull()
    expect(byId.get('loose')?.price).toEqual({ amount: 1200, currency: 'USD' })
    expect(sheet?.showPrices).toBe(true)
  })

  it('profile flags are off when no shared sheet has them on', async () => {
    await account.writeShareSettings({
      sheetIds: ['', 'fits'],
      allowClaims: false,
      showPrices: false,
    })
    const sheet = await publicSheet.loadPublicWishlist('sean')
    expect(sheet?.allowClaims).toBe(false)
    expect(sheet?.showPrices).toBe(false)
  })

  it("a stopped sheet's switches don't count toward the profile flags", async () => {
    await account.writeShareSettings({ sheetIds: [''], allowClaims: false })
    await account.writeShareSettings({ sheetIds: ['fits'], sharing: false })
    expect((await publicSheet.loadPublicWishlist('sean'))?.allowClaims).toBe(
      false,
    )
  })

  it('returns null for unknown people', async () => {
    expect(await publicSheet.loadPublicWishlist('nobody')).toBeNull()
  })
})

describe('claims', () => {
  beforeEach(async () => {
    await account.writeAccountItem(input('want'))
    await account.writeAccountItem(input('got', { status: 'purchased' }))
  })

  it('a friend claims; others see it taken but not by them', async () => {
    expect(
      await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want'),
    ).toEqual({ ok: true })
    const mine = await publicSheet.loadPublicWishlist('sean', { id: 'friend' })
    expect(mine?.items.find((i) => i.id === 'want')).toMatchObject({
      claimed: true,
      claimedByMe: true,
    })
    const theirs = await publicSheet.loadPublicWishlist('sean', { id: 'other' })
    expect(theirs?.items.find((i) => i.id === 'want')).toMatchObject({
      claimed: true,
      claimedByMe: false,
    })
  })

  it('the owner never sees claims (Q3 default)', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    const owner = await publicSheet.loadPublicWishlist('sean', { id: 'owner' })
    expect(owner?.items.every((i) => !i.claimed)).toBe(true)
  })

  it('one claim per item; claiming twice is fine for the same person', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    expect(
      await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want'),
    ).toEqual({ ok: true })
    expect(
      await publicSheet.claimPublicItem({ id: 'other' }, 'sean', 'want'),
    ).toEqual({
      ok: false,
      message: 'Someone already claimed this.',
    })
  })

  it('refuses signed-out, owners, got items, other lists and claims-off sheets', async () => {
    expect((await publicSheet.claimPublicItem(null, 'sean', 'want')).ok).toBe(
      false,
    )
    expect(
      (await publicSheet.claimPublicItem({ id: 'owner' }, 'sean', 'want')).ok,
    ).toBe(false)
    expect(
      (await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'got')).ok,
    ).toBe(false)
    expect(
      (await publicSheet.claimPublicItem({ id: 'friend' }, 'wanjiru', 'want'))
        .ok,
    ).toBe(false)
    await account.writeShareSettings({ sheetIds: [''], allowClaims: false })
    expect(
      await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want'),
    ).toEqual({
      ok: false,
      message: 'Claims are off for this sheet.',
    })
  })

  it('turning claims off hides existing claims', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    await account.writeShareSettings({ sheetIds: [''], allowClaims: false })
    const sheet = await publicSheet.loadPublicWishlist('sean', { id: 'friend' })
    expect(sheet?.items.every((i) => !i.claimed)).toBe(true)
  })

  it('the owner sees who claimed (Q1), with the name and when', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    expect((await wishlist()).claims).toEqual({
      want: { name: 'wanjiru name', at: expect.any(Number) },
    })
  })

  it('the owner gets null for a claimer with no display name (C106)', async () => {
    state.sqlite!.exec("update user set name = '  ' where id = 'friend'")
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    expect((await wishlist()).claims.want.name).toBeNull()
  })

  it("the owner doesn't see claims on claims-off sheets", async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    await account.writeShareSettings({ sheetIds: [''], allowClaims: false })
    expect((await wishlist()).claims).toEqual({})
  })

  it('claims are kept while sharing is off, and the owner still sees them', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    await account.writeShareSettings({ sheetIds: [''], sharing: false })
    expect(Object.keys((await wishlist()).claims)).toEqual(['want'])
    await account.writeShareSettings({ sheetIds: [''], sharing: true })
    const back = await publicSheet.loadPublicWishlist('sean', { id: 'other' })
    expect(back?.items.find((i) => i.id === 'want')?.claimed).toBe(true)
  })

  it('unshared sheet: a claimer sees only their own wanted stickers, unshared', async () => {
    await account.writeAccountItem(input('mine2'))
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    await publicSheet.claimPublicItem({ id: 'other' }, 'sean', 'mine2')
    await account.writeShareSettings({ sheetIds: [''], sharing: false })
    const friend = await publicSheet.loadPublicWishlist('sean', {
      id: 'friend',
    })
    expect(friend?.items.map((i) => i.id)).toEqual(['want'])
    expect(friend?.items[0]).toMatchObject({
      shared: false,
      claimed: true,
      claimedByMe: true,
    })
    const visitor = await publicSheet.loadPublicWishlist('sean')
    expect(visitor?.items).toEqual([])
    const owner = await publicSheet.loadPublicWishlist('sean', { id: 'owner' })
    expect(owner?.items).toEqual([])
  })

  it('unshared sheet with claims off returns nothing, even to the claimer', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    await account.writeShareSettings({
      sheetIds: [''],
      sharing: false,
      allowClaims: false,
    })
    expect(
      (await publicSheet.loadPublicWishlist('sean', { id: 'friend' }))?.items,
    ).toEqual([])
  })

  it('a claimer can still unclaim on an unshared sheet', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    await account.writeShareSettings({ sheetIds: [''], sharing: false })
    expect(
      await publicSheet.releasePublicClaim({ id: 'friend' }, 'want'),
    ).toEqual({ ok: true })
    expect(
      (await publicSheet.loadPublicWishlist('sean', { id: 'friend' }))?.items,
    ).toEqual([])
  })

  it('unshared category with a kept claim returns that category for the claimer', async () => {
    await account.writeAccountCategory({
      id: 'fits',
      name: 'fits',
      createdAt: 9,
    })
    await account.writeAccountItem(input('tee', { categoryId: 'fits' }))
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'tee')
    await account.writeShareSettings({ sheetIds: ['fits'], sharing: false })
    const friend = await publicSheet.loadPublicWishlist('sean', {
      id: 'friend',
    })
    expect(friend?.categories.map((row) => row.id)).toEqual(['fits'])
    const other = await publicSheet.loadPublicWishlist('sean', { id: 'other' })
    expect(other?.categories).toEqual([])
  })

  it('release only drops your own claim (undo)', async () => {
    await publicSheet.claimPublicItem({ id: 'friend' }, 'sean', 'want')
    await publicSheet.releasePublicClaim({ id: 'other' }, 'want')
    expect(
      (
        await publicSheet.loadPublicWishlist('sean', { id: 'other' })
      )?.items.find((i) => i.id === 'want')?.claimed,
    ).toBe(true)
    await publicSheet.releasePublicClaim({ id: 'friend' }, 'want')
    expect(
      (
        await publicSheet.loadPublicWishlist('sean', { id: 'other' })
      )?.items.find((i) => i.id === 'want')?.claimed,
    ).toBe(false)
  })
})

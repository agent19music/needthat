import { beforeEach, describe, expect, it, vi } from 'vitest'
import { item } from '../../test/fixtures'

const mocks = vi.hoisted(() => ({
  saveGuestItem: vi.fn(async () => {}),
  reorderAccountItemsFn: vi.fn(
    async () =>
      ({ ok: true as const, changed: 2 }) as { ok: boolean; message?: string },
  ),
}))
vi.mock('#/lib/guest-wishlist', () => ({
  deleteGuestItem: vi.fn(),
  loadGuestCategories: vi.fn(),
  loadGuestItems: vi.fn(),
  saveGuestCategory: vi.fn(),
  saveGuestItem: mocks.saveGuestItem,
}))
vi.mock('#/lib/wishlist/account', () => ({
  deleteAccountItem: vi.fn(),
  loadAccountWishlist: vi.fn(),
  reorderAccountItemsFn: mocks.reorderAccountItemsFn,
  saveAccountCategory: vi.fn(),
  saveAccountItem: vi.fn(),
}))

const { reorderActiveItems } = await import('./account-wishlist')

beforeEach(() => {
  mocks.saveGuestItem.mockClear()
  mocks.reorderAccountItemsFn.mockClear()
})

describe('reorderActiveItems', () => {
  const a = item({ id: 'a', position: 0 })
  const b = item({ id: 'b', position: 1 })
  const c = item({ id: 'c', position: 2 })

  it('guest: saves only the items whose position changed', async () => {
    const next = await reorderActiveItems(false, [a, b, c], ['b', 'a'])
    expect(next.find((entry) => entry.id === 'b')?.position).toBe(0)
    expect(next.find((entry) => entry.id === 'a')?.position).toBe(1)
    expect(mocks.saveGuestItem).toHaveBeenCalledTimes(2)
    expect(mocks.reorderAccountItemsFn).not.toHaveBeenCalled()
  })

  it('account: sends the stack order to the server', async () => {
    await reorderActiveItems(true, [a, b, c], ['c', 'b', 'a'])
    expect(mocks.reorderAccountItemsFn).toHaveBeenCalledWith({
      data: { ids: ['c', 'b', 'a'] },
    })
    expect(mocks.saveGuestItem).not.toHaveBeenCalled()
  })

  it('account: throws the server message so the UI can roll back', async () => {
    mocks.reorderAccountItemsFn.mockResolvedValueOnce({
      ok: false,
      message: 'That order could not be saved.',
    })
    await expect(reorderActiveItems(true, [a, b], ['b', 'a'])).rejects.toThrow(
      'That order could not be saved.',
    )
  })
})

import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

let seq = 0
export function item(overrides: Partial<GuestItem> = {}): GuestItem {
  seq += 1
  return {
    id: `item-${seq}`,
    title: `Item ${seq}`,
    brand: '',
    notes: '',
    sourceUrl: '',
    categoryId: null,
    status: 'unresolved',
    image: null,
    imageType: null,
    imageUrl: null,
    createdAt: 1_700_000_000_000 + seq * 1000,
    updatedAt: 1_700_000_000_000 + seq * 1000,
    position: null,
    purchasedAt: null,
    price: null,
    ...overrides,
  }
}

export function category(name: string, id = `cat-${name}`): GuestCategory {
  return { id, name, createdAt: 1 }
}

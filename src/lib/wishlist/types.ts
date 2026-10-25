export type StoredWishlistItem = {
  id: string
  title: string
  brand: string
  notes: string
  sourceUrl: string
  categoryId: string | null
  status: 'unresolved' | 'purchased'
  imageUrl: string | null
  /** Manual order inside a stack; null until the owner arranges or the backfill runs. */
  position: number | null
  /** When the item was marked got; null while wanted. */
  purchasedAt: number | null
  /** Latest priced offer, or null. Cards hide the price when this is null. */
  price: Price | null
  createdAt: number
  updatedAt: number
}

export type Price = { amount: number; currency: string }

export type SavedItemInput = {
  id: string
  title: string
  brand: string
  notes: string
  sourceUrl: string
  categoryId: string | null
  status: 'unresolved' | 'purchased'
  imageUrl: string | null
  imageBase64?: string
  imageType?: string
  createdAt: number
  updatedAt: number
}

export type SavedCategoryInput = {
  id: string
  name: string
  createdAt: number
}

export type PublicWishlist = {
  username: string
  name: string
  image: string | null
  imageVersion: string
  items: Array<{
    id: string
    title: string
    brand: string
    imageUrl: string | null
  }>
}

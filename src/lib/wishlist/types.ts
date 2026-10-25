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
  /** Price read from the shop link; stored as a new offer when it changes. */
  price?: Price | null
  createdAt: number
  updatedAt: number
}

export type TagColor = 'blue' | 'green' | 'red' | 'white'

export type SavedCategoryInput = {
  id: string
  name: string
  color?: TagColor | null
  createdAt: number
}

export type PublicSticker = {
  id: string
  title: string
  brand: string
  imageUrl: string | null
  sourceUrl: string
  categoryId: string | null
  position: number | null
  status: 'unresolved' | 'purchased'
  purchasedAt: number | null
  /** Null when the item has no offer or the owner hides prices. */
  price: Price | null
  createdAt: number
  /** Someone has claimed it (never who). Always false when claims are off. */
  claimed: boolean
  /** The signed-in viewer holds the claim. */
  claimedByMe: boolean
}

export type PublicWishlist = {
  username: string
  name: string
  image: string | null
  imageVersion: string
  /** Owner's share toggles (per list until Q7 is answered). */
  showPrices: boolean
  allowClaims: boolean
  categories: Array<{
    id: string
    name: string
    color: TagColor | null
    createdAt: number
  }>
  items: Array<PublicSticker>
}

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
  /**
   * r7: false for a sticker on a sheet that isn't shared right now. Only its
   * claimer ever gets one (Addendum 3: claims are kept while sharing is off).
   */
  shared: boolean
}

/** r7 (Q3 decided): one sheet's share settings. */
export type SheetShare = {
  showPrices: boolean
  allowClaims: boolean
  sharing: boolean
}

/** Key for the #unsorted sheet ("No sheet") in per-sheet settings maps. */
export const UNSORTED_SHEET = ''

/** r7 (Q1 decided): who claimed an owner's sticker, and when. */
export type OwnerClaim = {
  /** Claimer's display name, or null (C106 fallback). */
  name: string | null
  at: number
}

export type PublicWishlist = {
  username: string
  name: string
  image: string | null
  imageVersion: string
  /** r7: true when any shared sheet shows prices / allows claims. */
  showPrices: boolean
  allowClaims: boolean
  /** r7 (Q4): profile bio (C11) and the FOR kicker value (C12). */
  bio: string
  forLine: string
  /** r7: settings per sheet, by category id or UNSORTED_SHEET. */
  sheets: Record<string, SheetShare>
  categories: Array<{
    id: string
    name: string
    color: TagColor | null
    createdAt: number
  }>
  items: Array<PublicSticker>
}

export type StoredWishlistItem = {
  id: string
  title: string
  brand: string
  notes: string
  sourceUrl: string
  categoryId: string | null
  status: 'unresolved' | 'purchased'
  imageUrl: string | null
  createdAt: number
  updatedAt: number
}

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

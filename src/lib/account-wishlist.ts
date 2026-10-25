import {
  deleteGuestItem,
  loadGuestCategories,
  loadGuestItems,
  saveGuestCategory,
  saveGuestItem,
} from '#/lib/guest-wishlist'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'
import type { StoredWishlistItem } from '#/lib/wishlist/types'
import { reassignPositions } from '#/lib/wishlist/order'
import {
  deleteAccountItem,
  loadAccountWishlist,
  reorderAccountItemsFn,
  saveAccountCategory,
  saveAccountItem,
} from '#/lib/wishlist/account'

const importedKey = (userId: string) => `wishlist-imported:${userId}`

export async function loadActiveWishlist(signedIn: boolean) {
  if (!signedIn) {
    const [items, categories] = await Promise.all([
      loadGuestItems(),
      loadGuestCategories(),
    ])
    return { ok: true as const, items, categories }
  }
  const loaded = await loadAccountWishlist()
  if (!loaded.ok) return loaded
  return {
    ok: true as const,
    items: loaded.items.map(toGuestItem),
    categories: loaded.categories,
  }
}

export async function saveActiveItem(signedIn: boolean, item: GuestItem) {
  if (!signedIn) {
    await saveGuestItem(item)
    return
  }
  const result = await saveAccountItem({ data: await itemPayload(item) })
  if (!result.ok) throw new Error(result.message)
}

export async function deleteActiveItem(signedIn: boolean, id: string) {
  if (!signedIn) {
    await deleteGuestItem(id)
    return
  }
  const result = await deleteAccountItem({ data: { id } })
  if (!result.ok) throw new Error(result.message)
}

/**
 * Saves a new top-first order for one stack and returns the whole list with
 * positions applied. Other stacks keep their relative order. The signed-in
 * path lets the server recompute the same positions from its own rows.
 */
export async function reorderActiveItems(
  signedIn: boolean,
  all: Array<GuestItem>,
  stackIds: Array<string>,
) {
  const changes = reassignPositions(
    all.map((item) => ({
      id: item.id,
      position: item.position ?? null,
      createdAt: item.createdAt,
    })),
    stackIds,
  )
  const byId = new Map(changes.map((change) => [change.id, change.position]))
  const next = all.map((item) =>
    byId.has(item.id) ? { ...item, position: byId.get(item.id) } : item,
  )
  if (!signedIn) {
    for (const item of next) if (byId.has(item.id)) await saveGuestItem(item)
    return next
  }
  const result = await reorderAccountItemsFn({ data: { ids: stackIds } })
  if (!result.ok) throw new Error(result.message)
  return next
}

export async function saveActiveCategory(
  signedIn: boolean,
  category: GuestCategory,
) {
  if (!signedIn) {
    await saveGuestCategory(category)
    return
  }
  const result = await saveAccountCategory({
    data: {
      id: category.id,
      name: category.name,
      color: category.color ?? null,
      createdAt: category.createdAt,
    },
  })
  if (!result.ok) throw new Error(result.message)
}

export async function importGuestWishlist(userId: string) {
  if (localStorage.getItem(importedKey(userId))) return false
  const [items, categories] = await Promise.all([
    loadGuestItems(),
    loadGuestCategories(),
  ])
  for (const category of categories) {
    const result = await saveAccountCategory({
      data: {
        id: category.id,
        name: category.name,
        color: category.color ?? null,
        createdAt: category.createdAt,
      },
    })
    if (!result.ok) throw new Error(result.message)
  }
  for (const item of items) {
    const result = await saveAccountItem({ data: await itemPayload(item) })
    if (!result.ok) throw new Error(result.message)
  }
  localStorage.setItem(importedKey(userId), '1')
  return items.length > 0 || categories.length > 0
}

async function itemPayload(item: GuestItem) {
  const upload =
    item.image &&
    item.image.size > 0 &&
    !item.imageUrl?.startsWith('/api/images/')
  return {
    id: item.id,
    title: item.title,
    brand: item.brand,
    notes: item.notes,
    sourceUrl: item.sourceUrl,
    categoryId: item.categoryId,
    status: item.status,
    imageUrl:
      item.imageUrl && !item.imageUrl.startsWith('blob:')
        ? item.imageUrl
        : null,
    imageBase64: upload ? await blobToBase64(item.image as Blob) : undefined,
    imageType: upload ? (item.imageType ?? item.image?.type) : undefined,
    price: item.price ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function toGuestItem(item: StoredWishlistItem): GuestItem {
  return { ...item, image: null, imageType: null }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('The image could not be read.'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(blob)
  })
}

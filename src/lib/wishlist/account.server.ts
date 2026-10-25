import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import * as Sentry from '@sentry/tanstackstart-react'

import { getDb } from '#/db/index'
import {
  categories,
  claims,
  images,
  listItems,
  lists,
  offers,
  user,
} from '#/db/schema'
import {
  decodeImageBase64,
  isSafeImageUrl,
  putImageObject,
} from '#/lib/images/store-image.server'
import { readSession } from '#/lib/session.server'
import type { GuestCategory } from '#/lib/guest-wishlist'
import { cycleColor, isTagColor } from '#/lib/sticker/sheets'

import type {
  OwnerClaim,
  Price,
  SavedCategoryInput,
  SavedItemInput,
  SheetShare,
  StoredWishlistItem,
} from './types.ts'
import { UNSORTED_SHEET } from './types.ts'
import {
  latestPrices,
  nextPurchasedAt,
  reassignPositions,
  topPosition,
} from './order.ts'

const ITEM_IMAGE_MAX_BYTES = 8 * 1024 * 1024
const KEY = /^[A-Za-z0-9-]{1,80}$/

export async function readAccountWishlist() {
  return Sentry.startSpan({ name: 'Reading an account wishlist' }, async () => {
    const session = await readSession()
    if (!session) {
      return {
        ok: false as const,
        message: 'Sign in to open this wishlist.',
      }
    }
    const list = await findList(session.user.id)
    if (!list)
      return {
        ok: true as const,
        items: [],
        categories: [],
        claims: {},
      }
    const db = getDb()
    const [itemRows, categoryRows] = await Promise.all([
      db
        .select()
        .from(listItems)
        .where(eq(listItems.listId, list.id))
        .orderBy(
          sql`${listItems.position} is null`,
          asc(listItems.position),
          desc(listItems.createdAt),
        ),
      db
        .select()
        .from(categories)
        .where(eq(categories.listId, list.id))
        .orderBy(categories.createdAt),
    ])
    const prices = await readPrices(itemRows.map((row) => row.id))
    const claimable = new Set(
      itemRows
        .filter((row) => {
          if (row.status === 'purchased') return false
          const sheet = categoryRows.find((cat) => cat.id === row.categoryId)
          return sheet ? sheet.shareClaims : list.shareClaims
        })
        .map((row) => row.id),
    )
    return {
      ok: true as const,
      items: itemRows.map((row) =>
        toGuestItem(row, prices.get(row.id) ?? null),
      ),
      categories: categoryRows.map(toGuestCategory),
      claims: await readOwnerClaims([...claimable]),
    }
  })
}

export async function writeAccountItem(input: SavedItemInput) {
  return Sentry.startSpan({ name: 'Saving a wishlist item' }, async () => {
    const session = await readSession()
    if (!session) {
      return { ok: false as const, message: 'Sign in to save this item.' }
    }
    if (!KEY.test(input.id)) {
      return { ok: false as const, message: 'That item could not be saved.' }
    }
    const list = await ensureList(session.user.id)
    const db = getDb()
    const existing = await db
      .select()
      .from(listItems)
      .where(eq(listItems.id, input.id))
      .get()
    if (existing && existing.listId !== list.id) {
      return { ok: false as const, message: 'That item could not be saved.' }
    }
    let categoryId: string | null = null
    if (input.categoryId && KEY.test(input.categoryId)) {
      const category = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            eq(categories.listId, list.id),
          ),
        )
        .get()
      categoryId = category?.id ?? null
    }
    const imageUrl = await storedImageUrl(input)
    const now = new Date()
    const createdAt = existing?.createdAt ?? new Date(input.createdAt)
    const purchasedAtMs = nextPurchasedAt(
      existing
        ? {
            status: existing.status,
            purchasedAt: existing.purchasedAt?.getTime() ?? null,
          }
        : null,
      input.status,
      now.getTime(),
    )
    const purchasedAt = purchasedAtMs === null ? null : new Date(purchasedAtMs)
    // New items, and items moved to another stack, land on top of the pile.
    const position =
      existing &&
      existing.categoryId === categoryId &&
      existing.position !== null
        ? existing.position
        : await nextTopPosition(list.id)
    await db
      .insert(listItems)
      .values({
        id: input.id,
        listId: list.id,
        clientId: input.id,
        categoryId,
        title: input.title,
        brand: input.brand || null,
        notes: input.notes || null,
        imageUrl,
        status: input.status,
        sourceUrl: input.sourceUrl || null,
        position,
        purchasedAt,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: listItems.id,
        set: {
          categoryId,
          title: input.title,
          brand: input.brand || null,
          notes: input.notes || null,
          imageUrl,
          status: input.status,
          sourceUrl: input.sourceUrl || null,
          position,
          purchasedAt,
          updatedAt: now,
        },
      })
    if (input.price) await recordPrice(input.id, input.price, input.sourceUrl)
    if (imageUrl && imageUrl !== existing?.imageUrl)
      await recordDieImage(input.id, imageUrl)
    const { warmShareCardForUser } = await import('#/lib/og/card.server')
    warmShareCardForUser(session.user.id)
    return { ok: true as const }
  })
}

export async function removeAccountItem(id: string) {
  return Sentry.startSpan({ name: 'Removing a wishlist item' }, async () => {
    const session = await readSession()
    if (!session) {
      return { ok: false as const, message: 'Sign in to remove this item.' }
    }
    const list = await findList(session.user.id)
    if (!list) return { ok: true as const }
    await getDb()
      .delete(listItems)
      .where(and(eq(listItems.id, id), eq(listItems.listId, list.id)))
    const { warmShareCardForUser } = await import('#/lib/og/card.server')
    warmShareCardForUser(session.user.id)
    return { ok: true as const }
  })
}

export async function writeAccountCategory(input: SavedCategoryInput) {
  return Sentry.startSpan({ name: 'Saving a wishlist category' }, async () => {
    const session = await readSession()
    if (!session) {
      return { ok: false as const, message: 'Sign in to save this category.' }
    }
    if (!KEY.test(input.id)) {
      return {
        ok: false as const,
        message: 'That category could not be saved.',
      }
    }
    const list = await ensureList(session.user.id)
    const existing = await getDb()
      .select()
      .from(categories)
      .where(eq(categories.id, input.id))
      .get()
    if (existing && existing.listId !== list.id) {
      return {
        ok: false as const,
        message: 'That category could not be saved.',
      }
    }
    // A new tag takes the next slot in the sheet cycle unless the client sent one.
    const color = isTagColor(input.color)
      ? input.color
      : (existing?.color ??
        cycleColor(
          (
            await getDb()
              .select({ id: categories.id })
              .from(categories)
              .where(eq(categories.listId, list.id))
          ).length,
        ))
    await getDb()
      .insert(categories)
      .values({
        id: input.id,
        listId: list.id,
        name: input.name,
        color,
        createdAt: existing?.createdAt ?? new Date(input.createdAt),
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: { name: input.name, color },
      })
    return { ok: true as const, color }
  })
}

/**
 * Saves a new manual order for one stack. `ids` must be the stack's items in
 * the order the owner wants; every id must belong to the caller's list.
 * Items outside the stack keep their relative order.
 */
export async function reorderAccountItems(ids: Array<string>) {
  return Sentry.startSpan({ name: 'Reordering wishlist items' }, async () => {
    const session = await readSession()
    if (!session) {
      return { ok: false as const, message: 'Sign in to arrange this stack.' }
    }
    if (ids.length === 0 || ids.some((id) => !KEY.test(id))) {
      return { ok: false as const, message: 'That order could not be saved.' }
    }
    const list = await findList(session.user.id)
    if (!list) {
      return { ok: false as const, message: 'That order could not be saved.' }
    }
    const db = getDb()
    const rows = await db
      .select({
        id: listItems.id,
        position: listItems.position,
        createdAt: listItems.createdAt,
      })
      .from(listItems)
      .where(eq(listItems.listId, list.id))
    let changes: Array<{ id: string; position: number }>
    try {
      changes = reassignPositions(
        rows.map((row) => ({
          id: row.id,
          position: row.position,
          createdAt: row.createdAt.getTime(),
        })),
        ids,
      )
    } catch {
      return { ok: false as const, message: 'That order could not be saved.' }
    }
    for (const change of changes) {
      await db
        .update(listItems)
        .set({ position: change.position })
        .where(and(eq(listItems.id, change.id), eq(listItems.listId, list.id)))
    }
    return { ok: true as const, changed: changes.length }
  })
}

/**
 * r7 (Q1 decided): the owner sees who claimed each wanted sticker, kept
 * while a sheet's sharing is off. Name is the claimer's display name, or
 * null for the C106 fallback.
 */
async function readOwnerClaims(ids: Array<string>) {
  const out: Record<string, OwnerClaim> = {}
  for (let start = 0; start < ids.length; start += 90) {
    const rows = await getDb()
      .select({
        itemId: claims.itemId,
        createdAt: claims.createdAt,
        name: user.name,
      })
      .from(claims)
      .innerJoin(user, eq(user.id, claims.claimerId))
      .where(inArray(claims.itemId, ids.slice(start, start + 90)))
    for (const row of rows)
      out[row.itemId] = {
        name: row.name.trim() ? row.name.trim() : null,
        at: row.createdAt.getTime(),
      }
  }
  return out
}

/**
 * r7 (Q3 decided): share switches per sheet, keyed by category id. The
 * #unsorted sheet ("No sheet") keeps its settings on the list row.
 */
export async function readShareSettings() {
  const session = await readSession()
  if (!session) {
    return { ok: false as const, message: 'Sign in to change sharing.' }
  }
  const list = await findList(session.user.id)
  return { ok: true as const, ...(await sheetSettings(list)) }
}

async function sheetSettings(list: typeof lists.$inferSelect | undefined) {
  const sheets: Record<string, SheetShare> = {
    [UNSORTED_SHEET]: {
      showPrices: list?.sharePrices ?? true,
      allowClaims: list?.shareClaims ?? true,
      sharing: list?.shareOn ?? true,
    },
  }
  if (list) {
    const rows = await getDb()
      .select()
      .from(categories)
      .where(eq(categories.listId, list.id))
    for (const row of rows)
      sheets[row.id] = {
        showPrices: row.sharePrices,
        allowClaims: row.shareClaims,
        sharing: row.shareOn,
      }
  }
  return {
    sheets,
    bio: list?.bio ?? '',
    forLine: list?.forLine ?? '',
  }
}

/**
 * Writes one or more sheets' switches. `sheetIds` is the share target: one
 * sheet, or every sheet for Share all sheets. UNSORTED_SHEET is #unsorted.
 */
export async function writeShareSettings(input: {
  sheetIds: Array<string>
  showPrices?: boolean
  allowClaims?: boolean
  sharing?: boolean
}) {
  return Sentry.startSpan({ name: 'Saving share settings' }, async () => {
    const session = await readSession()
    if (!session) {
      return { ok: false as const, message: 'Sign in to change sharing.' }
    }
    const list = await ensureList(session.user.id)
    const db = getDb()
    const set: {
      sharePrices?: boolean
      shareClaims?: boolean
      shareOn?: boolean
    } = {}
    if (typeof input.showPrices === 'boolean')
      set.sharePrices = input.showPrices
    if (typeof input.allowClaims === 'boolean')
      set.shareClaims = input.allowClaims
    if (typeof input.sharing === 'boolean') set.shareOn = input.sharing
    const ids = [...new Set(input.sheetIds)]
    if (Object.keys(set).length > 0) {
      if (ids.includes(UNSORTED_SHEET))
        await db
          .update(lists)
          .set({ ...set, updatedAt: new Date() })
          .where(eq(lists.id, list.id))
      const sheetIds = ids.filter((id) => id !== UNSORTED_SHEET)
      if (sheetIds.length > 0)
        await db
          .update(categories)
          .set(set)
          .where(
            and(
              eq(categories.listId, list.id),
              inArray(categories.id, sheetIds),
            ),
          )
      const { warmShareCardForUser } = await import('#/lib/og/card.server')
      warmShareCardForUser(session.user.id)
    }
    const fresh = await findList(session.user.id)
    return { ok: true as const, ...(await sheetSettings(fresh)) }
  })
}

/** r7 (Q4): profile bio (C11) and FOR line (C12). */
/** C11 70 characters; C12 12 for the value ("FOR" is extra). */
export const BIO_MAX = 70
export const FOR_MAX = 12

export async function writeProfile(input: { bio: string; forLine: string }) {
  return Sentry.startSpan({ name: 'Saving profile' }, async () => {
    const session = await readSession()
    if (!session) {
      return { ok: false as const, message: 'Sign in to edit your profile.' }
    }
    const list = await ensureList(session.user.id)
    const bio = input.bio.replace(/\s+/g, ' ').trim().slice(0, BIO_MAX)
    const forLine = input.forLine.replace(/\s+/g, ' ').trim().slice(0, FOR_MAX)
    await getDb()
      .update(lists)
      .set({
        bio: bio || null,
        forLine: forLine || null,
        updatedAt: new Date(),
      })
      .where(eq(lists.id, list.id))
    return { ok: true as const, bio, forLine }
  })
}

/** Adds an offer row when the price read from the link differs from the latest one. */
async function recordPrice(itemId: string, price: Price, sourceUrl: string) {
  const latest = (await readPrices([itemId])).get(itemId)
  if (
    latest &&
    latest.amount === price.amount &&
    latest.currency === price.currency
  )
    return
  let host: string | null = null
  try {
    host = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, '') : null
  } catch {
    host = null
  }
  // One link offer per item: D1 timestamps are whole seconds, so a second
  // row in the same second could not be told apart from the first.
  await getDb()
    .delete(offers)
    .where(and(eq(offers.itemId, itemId), eq(offers.provider, 'link')))
  await getDb()
    .insert(offers)
    .values({
      id: crypto.randomUUID(),
      itemId,
      sourceName: host,
      url: sourceUrl || null,
      currency: price.currency,
      priceAmount: price.amount,
      provider: 'link',
      observedAt: new Date(),
    })
}

/** Records the baked sticker PNG as the item's `die` image (Bau Q11). */
async function recordDieImage(itemId: string, imageUrl: string) {
  const key = imageUrl.startsWith('/api/images/d-')
    ? imageUrl.slice('/api/images/'.length)
    : null
  if (!key) return
  const db = getDb()
  await db
    .delete(images)
    .where(and(eq(images.itemId, itemId), eq(images.role, 'die')))
  await db.insert(images).values({
    id: crypto.randomUUID(),
    itemId,
    r2Key: key,
    contentType: 'image/png',
    role: 'die',
    createdAt: new Date(),
  })
}

async function nextTopPosition(listId: string) {
  const rows = await getDb()
    .select({ position: listItems.position })
    .from(listItems)
    .where(eq(listItems.listId, listId))
  return topPosition(rows.map((row) => row.position))
}

async function readPrices(itemIds: Array<string>) {
  if (itemIds.length === 0) return new Map<string, Price>()
  const prices = new Map<string, Price>()
  // D1 caps bound parameters per statement, so read in chunks.
  for (let start = 0; start < itemIds.length; start += 90) {
    const rows = await getDb()
      .select({
        itemId: offers.itemId,
        priceAmount: offers.priceAmount,
        currency: offers.currency,
        observedAt: offers.observedAt,
      })
      .from(offers)
      .where(inArray(offers.itemId, itemIds.slice(start, start + 90)))
    for (const [id, price] of latestPrices(
      rows.map((row) => ({ ...row, observedAt: row.observedAt.getTime() })),
    ))
      prices.set(id, price)
  }
  return prices
}

async function findList(userId: string) {
  return getDb().select().from(lists).where(eq(lists.userId, userId)).get()
}

async function ensureList(userId: string) {
  const existing = await findList(userId)
  if (existing) return existing
  const now = new Date()
  const id = crypto.randomUUID()
  await getDb().insert(lists).values({
    id,
    userId,
    name: 'Wishlist',
    createdAt: now,
    updatedAt: now,
  })
  const created = await findList(userId)
  if (!created) throw new Error('The wishlist could not be created.')
  return created
}

async function storedImageUrl(input: SavedItemInput) {
  if (input.imageBase64) {
    const decoded = decodeImageBase64(input.imageBase64, ITEM_IMAGE_MAX_BYTES)
    if (!decoded) return cleanImageUrl(input.imageUrl)
    return putImageObject(`o-${input.id}`, decoded.bytes, decoded.contentType)
  }
  return cleanImageUrl(input.imageUrl)
}

function cleanImageUrl(value: string | null) {
  if (!value) return null
  if (value.startsWith('/api/images/')) {
    const key = value.slice('/api/images/'.length)
    return /^[aocgd]-[A-Za-z0-9-]{1,160}$/.test(key) ? value : null
  }
  return isSafeImageUrl(value) ? value : null
}

function toGuestItem(
  row: typeof listItems.$inferSelect,
  price: Price | null,
): StoredWishlistItem {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand ?? '',
    notes: row.notes ?? '',
    sourceUrl: row.sourceUrl ?? '',
    categoryId: row.categoryId,
    status: row.status === 'purchased' ? 'purchased' : 'unresolved',
    imageUrl: row.imageUrl,
    position: row.position,
    purchasedAt:
      row.purchasedAt?.getTime() ??
      (row.status === 'purchased' ? row.updatedAt.getTime() : null),
    price,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

function toGuestCategory(row: typeof categories.$inferSelect): GuestCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? null,
    createdAt: row.createdAt.getTime(),
  }
}

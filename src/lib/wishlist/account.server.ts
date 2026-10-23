import { and, desc, eq } from 'drizzle-orm'
import * as Sentry from '@sentry/tanstackstart-react'

import { getDb } from '#/db/index'
import { categories, listItems, lists } from '#/db/schema'
import {
  decodeImageBase64,
  isSafeImageUrl,
  putImageObject,
} from '#/lib/images/store-image.server'
import { readSession } from '#/lib/session.server'
import type { GuestCategory } from '#/lib/guest-wishlist'

import type {
  SavedCategoryInput,
  SavedItemInput,
  StoredWishlistItem,
} from './types.ts'

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
    if (!list) return { ok: true as const, items: [], categories: [] }
    const db = getDb()
    const [itemRows, categoryRows] = await Promise.all([
      db
        .select()
        .from(listItems)
        .where(eq(listItems.listId, list.id))
        .orderBy(desc(listItems.createdAt)),
      db
        .select()
        .from(categories)
        .where(eq(categories.listId, list.id))
        .orderBy(categories.createdAt),
    ])
    return {
      ok: true as const,
      items: itemRows.map(toGuestItem),
      categories: categoryRows.map(toGuestCategory),
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
          updatedAt: now,
        },
      })
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
      return { ok: false as const, message: 'That category could not be saved.' }
    }
    const list = await ensureList(session.user.id)
    const existing = await getDb()
      .select()
      .from(categories)
      .where(eq(categories.id, input.id))
      .get()
    if (existing && existing.listId !== list.id) {
      return { ok: false as const, message: 'That category could not be saved.' }
    }
    await getDb()
      .insert(categories)
      .values({
        id: input.id,
        listId: list.id,
        name: input.name,
        createdAt: existing?.createdAt ?? new Date(input.createdAt),
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: { name: input.name },
      })
    return { ok: true as const }
  })
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
    return /^[aocg]-[A-Za-z0-9-]{1,160}$/.test(key) ? value : null
  }
  return isSafeImageUrl(value) ? value : null
}

function toGuestItem(row: typeof listItems.$inferSelect): StoredWishlistItem {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand ?? '',
    notes: row.notes ?? '',
    sourceUrl: row.sourceUrl ?? '',
    categoryId: row.categoryId,
    status: row.status === 'purchased' ? 'purchased' : 'unresolved',
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

function toGuestCategory(
  row: typeof categories.$inferSelect,
): GuestCategory {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.getTime(),
  }
}

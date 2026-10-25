import { and, desc, eq, inArray } from 'drizzle-orm'
import * as Sentry from '@sentry/tanstackstart-react'

import { getDb } from '#/db/index'
import { categories, claims, listItems, lists, offers, user } from '#/db/schema'

import { latestPrices } from './order.ts'
import type { Price, PublicWishlist } from './types.ts'

type Viewer = { id: string } | null

/**
 * Everything a visitor may see on a shared sheet. Prices only when the owner
 * shows them; claims only as "taken" (Q3 default: nobody sees who), and the
 * owner never learns which items are claimed.
 */
export async function loadPublicWishlist(
  username: string,
  viewer: Viewer = null,
): Promise<PublicWishlist | null> {
  return Sentry.startSpan({ name: 'Reading a public wishlist' }, async () => {
    const db = getDb()
    const person = await db
      .select()
      .from(user)
      .where(eq(user.username, username))
      .get()
    if (!person?.username) return null
    const list = await db
      .select()
      .from(lists)
      .where(eq(lists.userId, person.id))
      .get()
    const showPrices = list?.sharePrices ?? true
    const allowClaims = list?.shareClaims ?? true
    // r3 Stop sharing: the page stays (Q7 open) but shows nothing shared.
    const sharing = list?.shareOn ?? true
    const isOwner = viewer?.id === person.id
    const rows =
      list && sharing
        ? await db
            .select()
            .from(listItems)
            .where(eq(listItems.listId, list.id))
            .orderBy(desc(listItems.createdAt))
        : []
    const categoryRows =
      list && sharing
        ? await db
            .select()
            .from(categories)
            .where(eq(categories.listId, list.id))
            .orderBy(categories.createdAt)
        : []
    const ids = rows.map((row) => row.id)
    const prices = showPrices ? await readPrices(ids) : new Map<string, Price>()
    const claimRows = allowClaims && !isOwner ? await readClaims(ids) : []
    const claimedBy = new Map(
      claimRows.map((row) => [row.itemId, row.claimerId]),
    )
    const items = rows.map((row) => {
      const claimer = claimedBy.get(row.id)
      const purchased = row.status === 'purchased'
      return {
        id: row.id,
        title: row.title,
        brand: row.brand ?? '',
        imageUrl: row.imageUrl,
        sourceUrl: row.sourceUrl ?? '',
        categoryId: row.categoryId,
        position: row.position,
        status: purchased ? ('purchased' as const) : ('unresolved' as const),
        purchasedAt: purchased
          ? (row.purchasedAt?.getTime() ?? row.updatedAt.getTime())
          : null,
        price: prices.get(row.id) ?? null,
        createdAt: row.createdAt.getTime(),
        claimed: Boolean(claimer) && !purchased,
        claimedByMe: Boolean(claimer) && claimer === viewer?.id && !purchased,
      }
    })
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        JSON.stringify({
          username: person.username,
          name: person.name,
          image: person.image,
          showPrices,
          sharing,
          categories: categoryRows.map((row) => [row.id, row.name, row.color]),
          items: items.map((item) => [
            item.id,
            item.imageUrl,
            item.title,
            item.status,
            item.categoryId,
            item.price?.amount ?? null,
          ]),
        }),
      ),
    )
    const imageVersion = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
    return {
      username: person.username,
      name: person.name,
      image: person.image,
      imageVersion,
      showPrices,
      allowClaims,
      categories: categoryRows.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color ?? null,
        createdAt: row.createdAt.getTime(),
      })),
      items,
    }
  })
}

async function readPrices(ids: Array<string>) {
  const prices = new Map<string, Price>()
  for (let start = 0; start < ids.length; start += 90) {
    const rows = await getDb()
      .select({
        itemId: offers.itemId,
        priceAmount: offers.priceAmount,
        currency: offers.currency,
        observedAt: offers.observedAt,
      })
      .from(offers)
      .where(inArray(offers.itemId, ids.slice(start, start + 90)))
    for (const [id, price] of latestPrices(
      rows.map((row) => ({ ...row, observedAt: row.observedAt.getTime() })),
    ))
      prices.set(id, price)
  }
  return prices
}

async function readClaims(ids: Array<string>) {
  const out: Array<{ itemId: string; claimerId: string }> = []
  for (let start = 0; start < ids.length; start += 90) {
    out.push(
      ...(await getDb()
        .select({ itemId: claims.itemId, claimerId: claims.claimerId })
        .from(claims)
        .where(inArray(claims.itemId, ids.slice(start, start + 90)))),
    )
  }
  return out
}

/** Claim ("I'll get this"). Owners can't claim their own items. */
export async function claimPublicItem(
  viewer: Viewer,
  username: string,
  itemId: string,
) {
  return Sentry.startSpan({ name: 'Claiming a wishlist item' }, async () => {
    if (!viewer) return { ok: false as const, message: 'Sign in to claim' }
    const target = await findSharedItem(username, itemId)
    if (!target)
      return {
        ok: false as const,
        message: "That sticker isn't on this sheet.",
      }
    if (target.ownerId === viewer.id)
      return {
        ok: false as const,
        message: "You can't claim your own sticker.",
      }
    if (!target.allowClaims)
      return { ok: false as const, message: 'Claims are off for this sheet.' }
    if (target.purchased)
      return { ok: false as const, message: 'They already got this one.' }
    const db = getDb()
    const existing = await db
      .select()
      .from(claims)
      .where(eq(claims.itemId, itemId))
      .get()
    if (existing) {
      return existing.claimerId === viewer.id
        ? { ok: true as const }
        : { ok: false as const, message: 'Someone already claimed this.' }
    }
    try {
      await db.insert(claims).values({
        id: crypto.randomUUID(),
        itemId,
        claimerId: viewer.id,
        createdAt: new Date(),
      })
    } catch {
      // Lost a race on the unique item index.
      return { ok: false as const, message: 'Someone already claimed this.' }
    }
    return { ok: true as const }
  })
}

export async function releasePublicClaim(viewer: Viewer, itemId: string) {
  return Sentry.startSpan({ name: 'Releasing a claim' }, async () => {
    if (!viewer) return { ok: false as const, message: 'Sign in to claim' }
    await getDb()
      .delete(claims)
      .where(and(eq(claims.itemId, itemId), eq(claims.claimerId, viewer.id)))
    return { ok: true as const }
  })
}

async function findSharedItem(username: string, itemId: string) {
  const db = getDb()
  const person = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .get()
  if (!person) return null
  const list = await db
    .select()
    .from(lists)
    .where(eq(lists.userId, person.id))
    .get()
  // Stop sharing: nothing on the list can be claimed either.
  if (!list || !list.shareOn) return null
  const item = await db
    .select({ id: listItems.id, status: listItems.status })
    .from(listItems)
    .where(and(eq(listItems.id, itemId), eq(listItems.listId, list.id)))
    .get()
  if (!item) return null
  return {
    ownerId: person.id,
    allowClaims: list.shareClaims,
    purchased: item.status === 'purchased',
  }
}

import { and, desc, eq, ne } from 'drizzle-orm'
import * as Sentry from '@sentry/tanstackstart-react'

import { getDb } from '#/db/index'
import { listItems, lists, user } from '#/db/schema'

import type { PublicWishlist } from './types.ts'

export async function loadPublicWishlist(
  username: string,
): Promise<PublicWishlist | null> {
  return Sentry.startSpan({ name: 'Reading a public wishlist' }, async () => {
    const person = await getDb()
      .select()
      .from(user)
      .where(eq(user.username, username))
      .get()
    if (!person?.username) return null
    const list = await getDb()
      .select()
      .from(lists)
      .where(eq(lists.userId, person.id))
      .get()
    const rows = list
      ? await getDb()
          .select({
            id: listItems.id,
            title: listItems.title,
            brand: listItems.brand,
            imageUrl: listItems.imageUrl,
          })
          .from(listItems)
          .where(
            and(
              eq(listItems.listId, list.id),
              ne(listItems.status, 'purchased'),
            ),
          )
          .orderBy(desc(listItems.createdAt))
      : []
    const items = rows.map((row) => ({
      id: row.id,
      title: row.title,
      brand: row.brand ?? '',
      imageUrl: row.imageUrl,
    }))
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        JSON.stringify({
          username: person.username,
          name: person.name,
          image: person.image,
          items: items.map((item) => [item.id, item.imageUrl, item.title]),
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
      items,
    }
  })
}

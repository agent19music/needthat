import { and, eq } from 'drizzle-orm'
import * as Sentry from '@sentry/tanstackstart-react'

import { getDb } from '#/db/index'
import { account, user } from '#/db/schema'
import { decodeImageBase64, putImageObject } from '#/lib/images/store-image.server'
import { readSession } from '#/lib/session.server'

const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export async function storeAvatar(imageBase64: string) {
  return Sentry.startSpan({ name: 'Storing a profile photo' }, async () => {
    const session = await readSession()
    if (!session) {
      return { ok: false as const, message: 'Sign in to update your photo.' }
    }
    const decoded = decodeImageBase64(imageBase64, AVATAR_MAX_BYTES)
    if (!decoded || decoded.contentType === 'image/gif') {
      return {
        ok: false as const,
        message: 'Use a JPEG, PNG, or WebP photo up to 2MB.',
      }
    }
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(session.user.id),
    )
    const hex = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 24)
    const key = `a-${hex}-${Date.now().toString(36)}`
    const url = await putImageObject(key, decoded.bytes, decoded.contentType)
    await getDb()
      .update(user)
      .set({ image: url, updatedAt: new Date() })
      .where(eq(user.id, session.user.id))
    const { warmShareCardForUser } = await import('./og/card.server')
    warmShareCardForUser(session.user.id)
    return { ok: true as const, url }
  })
}

export async function readPasswordStatus() {
  return Sentry.startSpan({ name: 'Reading password status' }, async () => {
    const session = await readSession()
    if (!session) return { hasPassword: false }
    const credential = await getDb()
      .select({ password: account.password })
      .from(account)
      .where(
        and(
          eq(account.userId, session.user.id),
          eq(account.providerId, 'credential'),
        ),
      )
      .get()
    return { hasPassword: Boolean(credential?.password) }
  })
}

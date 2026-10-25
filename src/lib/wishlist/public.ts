import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const username = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/)

const itemId = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{1,80}$/)

async function viewer() {
  const { readSession } = await import('#/lib/session.server')
  const session = await readSession().catch(() => null)
  return session ? { id: session.user.id } : null
}

export const getPublicWishlist = createServerFn({ method: 'GET' })
  .validator(z.object({ username }))
  .handler(async ({ data }) => {
    const { loadPublicWishlist } = await import('./public.server')
    return loadPublicWishlist(data.username, await viewer())
  })

export const claimItem = createServerFn({ method: 'POST' })
  .validator(z.object({ username, itemId }))
  .handler(async ({ data }) => {
    const { claimPublicItem } = await import('./public.server')
    return claimPublicItem(await viewer(), data.username, data.itemId)
  })

export const releaseClaim = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId }))
  .handler(async ({ data }) => {
    const { releasePublicClaim } = await import('./public.server')
    return releasePublicClaim(await viewer(), data.itemId)
  })

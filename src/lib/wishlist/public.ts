import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const getPublicWishlist = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      username: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(/^[a-z0-9_]+$/),
    }),
  )
  .handler(async ({ data }) => {
    const { loadPublicWishlist } = await import('./public.server')
    return loadPublicWishlist(data.username)
  })

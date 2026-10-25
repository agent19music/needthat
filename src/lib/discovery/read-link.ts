import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const readLinkInput = z.object({
  url: z.string().trim().min(4).max(2000),
})

/** Add-from-link: reads title, brand, images and price from a shop page. */
export const readProductLink = createServerFn({ method: 'POST' })
  .validator(readLinkInput)
  .handler(async ({ data }) => {
    const { readLink } = await import('./read-link.server')
    return readLink(data.url)
  })

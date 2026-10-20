import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const searchQuerySchema = z.object({
  query: z.string().trim().min(2).max(160),
})

export const searchProducts = createServerFn({ method: 'POST' })
  .validator(searchQuerySchema)
  .handler(async ({ data }) => {
    const { discoverProducts } = await import('./discover.server')
    return discoverProducts(data.query)
  })

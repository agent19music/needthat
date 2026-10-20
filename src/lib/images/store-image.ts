import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const itemId = z.string().trim().min(1).max(80)

export const ingestProductImage = createServerFn({ method: 'POST' })
  .validator(z.object({ itemId, url: z.string().trim().url().max(2000) }))
  .handler(async ({ data }) => {
    const { copyRemoteImage } = await import('./store-image.server')
    return copyRemoteImage(data.itemId, data.url)
  })

export const storeCleanImage = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      itemId,
      imageBase64: z.string().min(1).max(12_000_000),
    }),
  )
  .handler(async ({ data }) => {
    const { saveCleanImage } = await import('./store-image.server')
    return saveCleanImage(data.itemId, data.imageBase64)
  })

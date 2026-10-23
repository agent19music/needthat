import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const itemInput = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(120).default(''),
  notes: z.string().trim().max(2000).default(''),
  sourceUrl: z.string().trim().max(2000).default(''),
  categoryId: z.string().trim().min(1).max(80).nullable(),
  status: z.enum(['unresolved', 'purchased']),
  imageUrl: z.string().trim().max(2000).nullable(),
  imageBase64: z.string().max(12_000_000).optional(),
  imageType: z.string().max(80).optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})

const categoryInput = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(40),
  createdAt: z.number().int().positive(),
})

export const loadAccountWishlist = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readAccountWishlist } = await import('./account.server')
    return readAccountWishlist()
  },
)

export const saveAccountItem = createServerFn({ method: 'POST' })
  .validator(itemInput)
  .handler(async ({ data }) => {
    const { writeAccountItem } = await import('./account.server')
    return writeAccountItem(data)
  })

export const deleteAccountItem = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().trim().min(1).max(80) }))
  .handler(async ({ data }) => {
    const { removeAccountItem } = await import('./account.server')
    return removeAccountItem(data.id)
  })

export const reorderItemsInput = z.object({
  ids: z.array(z.string().trim().min(1).max(80)).min(1).max(500),
})

export const reorderAccountItemsFn = createServerFn({ method: 'POST' })
  .validator(reorderItemsInput)
  .handler(async ({ data }) => {
    const { reorderAccountItems } = await import('./account.server')
    return reorderAccountItems(data.ids)
  })

export const saveAccountCategory = createServerFn({ method: 'POST' })
  .validator(categoryInput)
  .handler(async ({ data }) => {
    const { writeAccountCategory } = await import('./account.server')
    return writeAccountCategory(data)
  })

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const priceInput = z.object({
  amount: z.number().int().nonnegative().max(1_000_000_000_00),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase()),
})

export const tagColorInput = z.enum(['blue', 'green', 'red', 'white'])

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
  price: priceInput.nullable().optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})

export const categoryInput = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(40),
  color: tagColorInput.nullable().optional(),
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

export const shareSettingsInput = z.object({
  showPrices: z.boolean().optional(),
  allowClaims: z.boolean().optional(),
  sharing: z.boolean().optional(),
})

export const loadShareSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readShareSettings } = await import('./account.server')
    return readShareSettings()
  },
)

export const saveShareSettings = createServerFn({ method: 'POST' })
  .validator(shareSettingsInput)
  .handler(async ({ data }) => {
    const { writeShareSettings } = await import('./account.server')
    return writeShareSettings(data)
  })

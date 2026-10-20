import { z } from 'zod'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const itemDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Add a name')
    .max(160, 'Keep the name under 160 characters'),
  brand: z.string().trim().max(80, 'Keep the brand under 80 characters'),
  notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
  sourceUrl: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || isHttpUrl(value),
      'Use an http or https link',
    ),
})

export type ItemDraft = z.infer<typeof itemDraftSchema>

export function validateImageFile(file: File): string | null {
  if (
    !ACCEPTED_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    )
  ) {
    return 'Use a JPEG, PNG, WebP, or GIF.'
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be 8 MB or smaller.'
  }

  return null
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

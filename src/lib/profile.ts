import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const uploadAvatar = createServerFn({ method: 'POST' })
  .validator(z.object({ imageBase64: z.string().min(1).max(2_800_000) }))
  .handler(async ({ data }) => {
    const { storeAvatar } = await import('./profile.server')
    return storeAvatar(data.imageBase64)
  })

export const getPasswordStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readPasswordStatus } = await import('./profile.server')
    return readPasswordStatus()
  },
)

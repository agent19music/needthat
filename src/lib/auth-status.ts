import { createServerFn } from '@tanstack/react-start'

export const getGoogleAuthReady = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { isGoogleAuthReady } = await import('./auth')
    return { ready: isGoogleAuthReady() }
  },
)

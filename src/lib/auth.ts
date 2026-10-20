import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { getDb } from '#/db/index'
import * as authSchema from '#/db/auth-schema'

function createAuth() {
  const googleReady = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: 'sqlite',
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: googleReady
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
    plugins: [tanstackStartCookies()],
  })
}

let cached: ReturnType<typeof createAuth> | undefined

export function getAuth() {
  cached ??= createAuth()
  return cached
}

export function isGoogleAuthReady() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

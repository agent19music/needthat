import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { getDb } from '#/db/index'
import * as authSchema from '#/db/auth-schema'

import { escapeHtml, sendAuthEmail } from './email.server.ts'

const RESERVED_USERNAMES = new Set([
  'account',
  'admin',
  'api',
  'manifest.webmanifest',
  'og',
  'reset-password',
  'robots.txt',
  'sign-in',
  'sign-up',
  'sitemap.xml',
  'u',
])

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
      enabled: true,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: 'Reset your #needthat password',
          text: `Choose a new password: ${url}`,
          html: `<p>Choose a new password for #needthat.</p><p><a href="${escapeHtml(url)}">Reset password</a></p>`,
        })
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: 'Confirm your #needthat email',
          text: `Confirm this email for #needthat: ${url}`,
          html: `<p>Confirm this email for #needthat.</p><p><a href="${escapeHtml(url)}">Confirm email</a></p>`,
        })
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          await sendAuthEmail({
            to: user.email,
            subject: 'Confirm your new #needthat email',
            text: `Confirm ${newEmail} as your #needthat email: ${url}`,
            html: `<p>Confirm ${escapeHtml(newEmail)} as your #needthat email.</p><p><a href="${escapeHtml(url)}">Confirm email</a></p>`,
          })
        },
      },
    },
    session: {
      additionalFields: {
        city: { type: 'string', required: false, input: false },
        country: { type: 'string', required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            const cf = (
              context?.request as
                | (Request & { cf?: { city?: unknown; country?: unknown } })
                | undefined
            )?.cf
            const city = typeof cf?.city === 'string' ? cf.city : undefined
            const country =
              typeof cf?.country === 'string' ? cf.country : undefined
            return {
              data: {
                ...session,
                ...(city ? { city } : {}),
                ...(country ? { country } : {}),
              },
            }
          },
        },
      },
    },
    socialProviders: googleReady
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
    plugins: [
      tanstackStartCookies(),
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator: (value) => {
          if (!/^[a-zA-Z0-9_]+$/.test(value)) return false
          return !RESERVED_USERNAMES.has(value.toLowerCase())
        },
      }),
    ],
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

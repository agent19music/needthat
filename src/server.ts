import * as Sentry from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'
import { wrapFetchWithSentry } from '@sentry/tanstackstart-react'

export default Sentry.withSentry(
  (env) => {
    if (!env.SENTRY_DSN) return undefined

    return {
      dsn: env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      dataCollection: {
        userInfo: false,
        httpBodies: [],
      },
    }
  },
  // TanStack Start's server entry is not typed as the handler Sentry expects.
  // @ts-expect-error handler fetch options differ from the Sentry wrapper
  wrapFetchWithSentry(handler),
)

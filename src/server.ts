import * as Sentry from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'
import { wrapFetchWithSentry } from '@sentry/tanstackstart-react'

const app = Sentry.withSentry(
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

function anonymousHome(request: Request) {
  if (request.method !== 'GET' || import.meta.env.DEV) return false
  const url = new URL(request.url)
  return url.pathname === '/' && url.search === '' && !request.headers.has('cookie')
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (!anonymousHome(request)) return app.fetch(request, env, ctx)

    const cache = caches.default
    const hit = await cache.match(request)
    if (hit) return hit

    const response = await app.fetch(request, env, ctx)
    const type = response.headers.get('content-type') ?? ''
    if (
      !response.ok ||
      !type.includes('text/html') ||
      response.headers.has('set-cookie')
    ) {
      return response
    }

    const headers = new Headers(response.headers)
    headers.set('cache-control', 'public, max-age=60, s-maxage=300')
    const cached = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
    ctx.waitUntil(cache.put(request, cached.clone()))
    return cached
  },
}

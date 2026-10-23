import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/og/u/$username')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const username = params.username.toLowerCase()
        const fallback = () =>
          Response.redirect(new URL('/og.jpg', request.url), 302)
        if (!/^[a-z0-9_]{3,30}$/.test(username)) return fallback()
        try {
          const { readOrRenderShareCard } = await import('#/lib/og/card.server')
          const png = await readOrRenderShareCard(
            username,
            new URL(request.url).origin,
          )
          if (!png) return fallback()
          const body = new ArrayBuffer(png.byteLength)
          new Uint8Array(body).set(png)
          return new Response(body, {
            headers: {
              'content-type': 'image/png',
              'cache-control': 'public, max-age=300',
            },
          })
        } catch (error) {
          console.error(error)
          return fallback()
        }
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'

import { siteOrigin } from '#/lib/site'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        const origin = await siteOrigin()
        const body = [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          'Disallow: /account',
          'Disallow: /sign-in',
          'Disallow: /sign-up',
          'Disallow: /reset-password',
          ...(origin ? ['', `Sitemap: ${origin}/sitemap.xml`] : []),
          '',
        ].join('\n')

        return new Response(body, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'

import { logo, siteDescription, siteName, themeColor } from '#/lib/site'

export const Route = createFileRoute('/manifest.webmanifest')({
  server: {
    handlers: {
      GET: () => {
        const body = {
          name: siteName,
          short_name: siteName,
          description: siteDescription,
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f8f7f1',
          theme_color: themeColor.light,
          icons: [
            {
              src: '/favicon-32x32.png',
              sizes: '32x32',
              type: 'image/png',
            },
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
            },
            {
              src: '/favicon.ico',
              sizes: '48x48',
              type: 'image/x-icon',
            },
            {
              src: logo.path,
              sizes: `${logo.width}x${logo.height}`,
              type: logo.type,
            },
          ],
        }

        return new Response(JSON.stringify(body), {
          headers: {
            'content-type': 'application/manifest+json; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'

import { getImageBucket } from '#/db/index'

export const Route = createFileRoute('/api/images/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[aocgd]-[A-Za-z0-9-]{1,160}$/.test(params.key)) {
          return new Response('Not found', { status: 404 })
        }
        const object = await getImageBucket().get(params.key)
        if (!object) return new Response('Not found', { status: 404 })
        return new Response(object.body, {
          headers: {
            'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
            'cache-control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { and, eq, isNotNull, ne } from 'drizzle-orm'

import { getDb } from '#/db/index'
import { listItems, lists, user } from '#/db/schema'
import { siteOrigin } from '#/lib/site'

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const origin = await siteOrigin()
        const shared = origin
          ? await getDb()
              .selectDistinct({ username: user.username })
              .from(user)
              .innerJoin(lists, eq(lists.userId, user.id))
              .innerJoin(listItems, eq(listItems.listId, lists.id))
              .where(
                and(isNotNull(user.username), ne(listItems.status, 'purchased')),
              )
          : []
        const urls = origin
          ? [
              `<url><loc>${xmlEscape(`${origin}/`)}</loc></url>`,
              ...shared.flatMap((row) =>
                row.username
                  ? [
                      `<url><loc>${xmlEscape(`${origin}/u/${row.username}`)}</loc></url>`,
                    ]
                  : [],
              ),
            ].join('\n')
          : ''
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

        return new Response(body, {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})

import { ImageIcon } from '@phosphor-icons/react'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { Card } from '#/components/arc/card/card'
import { publicListHead, siteOrigin } from '#/lib/site'
import { getPublicWishlist } from '#/lib/wishlist/public'

export const Route = createFileRoute('/u/$username')({
  loader: async ({ params }) => {
    const username = params.username.toLowerCase()
    if (!/^[a-z0-9_]{3,30}$/.test(username)) throw notFound()
    const profile = await getPublicWishlist({ data: { username } })
    if (!profile) throw notFound()
    return profile
  },
  head: async ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: '#needthat' }] }
    return publicListHead(await siteOrigin(), loaderData)
  },
  component: PublicWishlistPage,
})

function PublicWishlistPage() {
  const profile = Route.useLoaderData()
  return (
    <main className="wishlist-page">
      <div className="public-list">
        <section>
          <header className="mb-8">
            <h1>{profile.name}</h1>
            <p className="wishlist-note mt-3">@{profile.username} on #needthat</p>
          </header>
          {profile.items.length === 0 ? (
            <div className="empty-state">
              <img
                src="/empty-state-needthat.webp"
                alt=""
                width={1684}
                height={2528}
              />
              <div className="empty-state-copy">
                <p className="empty-state-title">Nothing shared yet</p>
                <p className="empty-state-hint">
                  Wishes show up here once they are added.
                </p>
              </div>
            </div>
          ) : (
            <ul className="mt-8 grid grid-cols-2 items-stretch gap-x-4 gap-y-8 sm:grid-cols-3">
              {profile.items.map((item) => (
                <li key={item.id} className="flex min-w-0">
                  <Card
                    title={item.title}
                    description={item.brand || undefined}
                    media={
                      <div className="flex h-full w-full items-center justify-center">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="max-h-full max-w-full object-contain p-3"
                          />
                        ) : (
                          <ImageIcon
                            style={{ color: 'var(--text-muted)' }}
                            size={28}
                          />
                        )}
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

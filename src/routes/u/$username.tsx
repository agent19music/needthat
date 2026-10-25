import { createFileRoute, notFound } from '@tanstack/react-router'

import { PublicBoard } from '#/components/sticker/public-board'
import { authClient } from '#/lib/auth-client'
import { publicListHead, siteOrigin } from '#/lib/site'
import { getPublicWishlist } from '#/lib/wishlist/public'

export const Route = createFileRoute('/u/$username')({
  validateSearch: (search: Record<string, unknown>): { sheet?: string } =>
    typeof search.sheet === 'string' &&
    /^[A-Za-z0-9-]{1,64}$/.test(search.sheet)
      ? { sheet: search.sheet }
      : {},
  loader: async ({ params }) => {
    const username = params.username.toLowerCase()
    if (!/^[a-z0-9_]{3,30}$/.test(username)) throw notFound()
    const profile = await getPublicWishlist({ data: { username } })
    if (!profile) throw notFound()
    return profile
  },
  head: async ({ loaderData, match }) => {
    if (!loaderData) return { meta: [{ title: '#needthat' }] }
    const category = loaderData.categories.find(
      (entry) => entry.id === match.search.sheet,
    )
    return publicListHead(
      await siteOrigin(),
      loaderData,
      category ? { id: category.id, name: category.name } : null,
    )
  },
  component: PublicWishlistPage,
})

function PublicWishlistPage() {
  const profile = Route.useLoaderData()
  const { sheet } = Route.useSearch()
  const { data: session } = authClient.useSession()
  return (
    <PublicBoard
      profile={profile}
      sheetId={sheet ?? null}
      signedIn={Boolean(session?.user)}
    />
  )
}

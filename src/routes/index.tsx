import { createFileRoute } from '@tanstack/react-router'

import { WishlistScreen } from '#/components/wishlist/wishlist-screen'
import { homeHead, siteOrigin } from '#/lib/site'

export const Route = createFileRoute('/')({
  head: async () => homeHead(await siteOrigin()),
  component: WishlistScreen,
})

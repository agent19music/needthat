import { createFileRoute } from '@tanstack/react-router'

import { WishlistScreen } from '#/components/wishlist/wishlist-screen'

export const Route = createFileRoute('/')({ component: WishlistScreen })

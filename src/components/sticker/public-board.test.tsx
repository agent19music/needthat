import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithRouter } from '../../../test/router'
import type { PublicSticker, PublicWishlist } from '#/lib/wishlist/types'

const claimItem = vi.fn()
const releaseClaim = vi.fn()
vi.mock('#/lib/wishlist/public', () => ({
  claimItem: (input: unknown) => claimItem(input),
  releaseClaim: (input: unknown) => releaseClaim(input),
}))

const { PublicBoard } = await import('./public-board')

function sticker(overrides: Partial<PublicSticker>): PublicSticker {
  return {
    id: 'x',
    title: 'X',
    brand: '',
    imageUrl: null,
    sourceUrl: 'https://shop.example/x',
    categoryId: 'fits',
    position: null,
    status: 'unresolved',
    purchasedAt: null,
    price: { amount: 8500, currency: 'USD' },
    createdAt: 1,
    claimed: false,
    claimedByMe: false,
    ...overrides,
  }
}

const profile: PublicWishlist = {
  username: 'sean',
  name: 'Sean Motanya',
  image: null,
  imageVersion: '1',
  showPrices: true,
  allowClaims: true,
  categories: [{ id: 'fits', name: 'Fits', color: 'green', createdAt: 1 }],
  items: [
    sticker({ id: 'top', title: 'Raglan sweatshirt' }),
    sticker({ id: 'shoe', title: 'Samba OG', claimed: true }),
  ],
}

describe('PublicBoard (S7 claim view)', () => {
  it('tags claimed stickers and asks signed-out friends to sign in', async () => {
    renderWithRouter(() => (
      <PublicBoard profile={profile} sheetId={null} signedIn={false} />
    ))
    expect(
      await screen.findByRole('heading', { name: 'Sean Motanya' }),
    ).toBeInTheDocument()
    expect(screen.getByText('CLAIMED')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Raglan sweatshirt/ }))
    expect(
      await screen.findByRole('link', { name: 'Sign in to claim' }),
    ).toHaveAttribute('href', '/sign-in?redirect=%2Fu%2Fsean')
    expect(
      screen.getByText(
        "Sean won't see who claimed it. Friends just see it's taken.",
      ),
    ).toBeInTheDocument()
  })

  it('claims a sticker and offers Undo', async () => {
    claimItem.mockResolvedValueOnce({ ok: true })
    renderWithRouter(() => (
      <PublicBoard profile={profile} sheetId={null} signedIn />
    ))
    fireEvent.click(
      await screen.findByRole('button', { name: /^Raglan sweatshirt/ }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: "Claim it · I'll get this" }),
    )
    await waitFor(() =>
      expect(claimItem).toHaveBeenCalledWith({
        data: { username: 'sean', itemId: 'top' },
      }),
    )
    expect(
      await screen.findByText("Claimed. Only you can see it's you"),
    ).toBeInTheDocument()
    expect(screen.getByText('CLAIMED')).toBeInTheDocument()
    expect(screen.getByText('Claimed by you')).toBeInTheDocument()
  })
})

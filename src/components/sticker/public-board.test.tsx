import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithRouter } from '../../../test/router'
import { setMediaMatches } from '../../../test/setup'
import type { PublicSticker, PublicWishlist } from '#/lib/wishlist/types'

const claimItem = vi.fn()
const releaseClaim = vi.fn()
vi.mock('#/lib/wishlist/public', () => ({
  claimItem: (input: unknown) => claimItem(input),
  releaseClaim: (input: unknown) => releaseClaim(input),
}))

const { PublicBoard } = await import('./public-board')

const ON = { showPrices: true, allowClaims: true, sharing: true }
const OFF = { showPrices: true, allowClaims: true, sharing: false }

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
    shared: true,
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
  bio: '',
  forLine: '',
  sheets: { '': ON, fits: ON },
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
    expect(screen.getByText('Claimed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Raglan sweatshirt/ }))
    expect(
      await screen.findByRole('link', { name: 'Sign in to claim' }),
    ).toHaveAttribute('href', '/sign-in?redirect=%2Fu%2Fsean')
    expect(
      screen.getByText('The owner can see that you claimed it'),
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
    const toast = await screen.findByRole('status')
    await waitFor(() => expect(toast).toHaveTextContent(/^Claimed\.Undo$/))
    expect(within(toast).getByText('Claimed.')).toBeInTheDocument()
    expect(screen.getByText('Claimed')).toBeInTheDocument()
    expect(screen.getByText('Claimed by you')).toBeInTheDocument()
  })

  it('visitors never see a claimer name', async () => {
    renderWithRouter(() => (
      <PublicBoard profile={profile} sheetId={null} signedIn />
    ))
    await screen.findByRole('heading', { name: 'Sean Motanya' })
    expect(screen.queryByText(/^Claimed by (?!you)/)).toBeNull()
  })
})

const wide = () =>
  setMediaMatches(['(prefers-reduced-motion: reduce)', '(min-width: 768px)'])

describe('PublicBoard r7 per-sheet sharing', () => {
  afterEach(() => setMediaMatches(['(prefers-reduced-motion: reduce)']))

  it.each([false, true])(
    'unshared sheet, visitor with no claim (wide=%s): only the C107 title',
    async (isWide) => {
      if (isWide) wide()
      renderWithRouter(() => (
        <PublicBoard
          profile={{
            ...profile,
            sheets: { '': ON, fits: OFF },
            categories: [],
            items: [],
          }}
          sheetId="fits"
          signedIn
        />
      ))
      expect(
        await screen.findByRole('heading', {
          name: "This sheet isn't shared right now",
        }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Your claims? (is|are) saved/)).toBeNull()
      expect(
        screen.queryByRole('button', { name: /How claiming works/ }),
      ).toBeNull()
      expect(
        screen.queryAllByRole('button', { name: /Raglan|Samba/ }),
      ).toHaveLength(0)
    },
  )

  it.each([false, true])(
    'unshared sheet, claimer (wide=%s): C108 then only their own stickers with C110',
    async (isWide) => {
      if (isWide) wide()
      renderWithRouter(() => (
        <PublicBoard
          profile={{
            ...profile,
            sheets: { '': ON, fits: OFF },
            items: [
              sticker({
                id: 'mine',
                title: 'Samba OG',
                claimed: true,
                claimedByMe: true,
                shared: false,
              }),
            ],
          }}
          sheetId="fits"
          signedIn
        />
      ))
      expect(
        await screen.findByRole('heading', {
          name: "This sheet isn't shared right now",
        }),
      ).toBeInTheDocument()
      expect(screen.getByText('Your claim is saved.')).toBeInTheDocument()
      expect(screen.getAllByText('Claimed by you').length).toBeGreaterThan(0)
      expect(screen.queryByText('Raglan sweatshirt')).toBeNull()
    },
  )

  it('claimer can Unclaim from the unshared page', async () => {
    releaseClaim.mockResolvedValueOnce({ ok: true })
    renderWithRouter(() => (
      <PublicBoard
        profile={{
          ...profile,
          sheets: { '': ON, fits: OFF },
          items: [
            sticker({
              id: 'mine',
              title: 'Samba OG',
              claimed: true,
              claimedByMe: true,
              shared: false,
            }),
          ],
        }}
        sheetId="fits"
        signedIn
      />
    ))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /^Samba OG/ }))[0],
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Unclaim' }))
    await waitFor(() =>
      expect(releaseClaim).toHaveBeenCalledWith({ data: { itemId: 'mine' } }),
    )
  })

  it('plural C108 with two kept claims', async () => {
    renderWithRouter(() => (
      <PublicBoard
        profile={{
          ...profile,
          sheets: { '': ON, fits: OFF },
          items: ['a', 'b'].map((id) =>
            sticker({
              id,
              title: id,
              claimed: true,
              claimedByMe: true,
              shared: false,
            }),
          ),
        }}
        sheetId="fits"
        signedIn
      />
    ))
    expect(
      await screen.findByText('Your claims are saved.'),
    ).toBeInTheDocument()
  })

  it('bare link with every sheet off reads as unshared', async () => {
    renderWithRouter(() => (
      <PublicBoard
        profile={{
          ...profile,
          sheets: { '': OFF, fits: OFF },
          categories: [],
          items: [],
        }}
        sheetId={null}
        signedIn={false}
      />
    ))
    expect(
      await screen.findByRole('heading', {
        name: "This sheet isn't shared right now",
      }),
    ).toBeInTheDocument()
  })

  it('an unknown ?sheet= reads as unshared', async () => {
    renderWithRouter(() => (
      <PublicBoard profile={profile} sheetId="nope" signedIn={false} />
    ))
    expect(
      await screen.findByRole('heading', {
        name: "This sheet isn't shared right now",
      }),
    ).toBeInTheDocument()
  })

  it('C70 hidden when claiming is off on the sheet; shown when on', async () => {
    const { unmount } = renderWithRouter(() => (
      <PublicBoard
        profile={{
          ...profile,
          sheets: { '': ON, fits: { ...ON, allowClaims: false } },
        }}
        sheetId="fits"
        signedIn
      />
    ))
    await screen.findByRole('heading', { name: 'Sean Motanya' })
    expect(
      screen.queryByRole('button', { name: /How claiming works/ }),
    ).toBeNull()
    unmount()
    renderWithRouter(() => (
      <PublicBoard profile={profile} sheetId="fits" signedIn />
    ))
    expect(
      await screen.findByRole('button', { name: /How claiming works/ }),
    ).toBeInTheDocument()
  })

  it('claiming off on a sheet: tapping a sticker opens nothing', async () => {
    renderWithRouter(() => (
      <PublicBoard
        profile={{
          ...profile,
          allowClaims: false,
          sheets: { '': ON, fits: { ...ON, allowClaims: false } },
        }}
        sheetId={null}
        signedIn
      />
    ))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /^Raglan sweatshirt/ }))[0],
    )
    expect(
      screen.queryByRole('button', { name: "Claim it · I'll get this" }),
    ).toBeNull()
  })

  it('How claiming works: steps, privacy line and OK', async () => {
    renderWithRouter(() => (
      <PublicBoard profile={profile} sheetId={null} signedIn />
    ))
    fireEvent.click(
      await screen.findByRole('button', { name: /How claiming works/ }),
    )
    expect(await screen.findByText('Pick a sticker')).toBeInTheDocument()
    expect(screen.getByText('Claim it')).toBeInTheDocument()
    expect(screen.getByText('Buy and give it')).toBeInTheDocument()
    expect(
      screen.getAllByText('The owner can see that you claimed it').length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
  })

  it('nothing shared yet: C78 and C79', async () => {
    renderWithRouter(() => (
      <PublicBoard
        profile={{ ...profile, categories: [], items: [] }}
        sheetId={null}
        signedIn={false}
      />
    ))
    expect(
      await screen.findByText('No stickers shared yet'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sheets this person shares will appear here.'),
    ).toBeInTheDocument()
  })

  it('cover note shows the bio and FOR line', async () => {
    wide()
    renderWithRouter(() => (
      <PublicBoard
        profile={{ ...profile, bio: 'Coffee and film', forLine: 'Birthday' }}
        sheetId={null}
        signedIn={false}
      />
    ))
    expect(await screen.findByText('Coffee and film')).toBeInTheDocument()
    expect(document.querySelector('.nt-cover-for')).toHaveTextContent(
      'For Birthday',
    )
  })

  it('C85 Make a wishlist for signed-out visitors', async () => {
    renderWithRouter(() => (
      <PublicBoard profile={profile} sheetId={null} signedIn={false} />
    ))
    expect(
      (await screen.findAllByText('Make a wishlist')).length,
    ).toBeGreaterThan(0)
  })

  it.each([false, true])(
    'r8: the unshared page keeps the sheet tabs above C107, none active (wide=%s)',
    async (isWide) => {
      if (isWide) wide()
      renderWithRouter(() => (
        <PublicBoard
          profile={{
            ...profile,
            sheets: { '': ON, fits: OFF, home: ON },
            categories: [
              { id: 'fits', name: 'Fits', color: 'green', createdAt: 1 },
              { id: 'home', name: 'Home', color: 'blue', createdAt: 2 },
            ],
            items: [sticker({ id: 'lamp', title: 'Lamp', categoryId: 'home' })],
          }}
          sheetId="fits"
          signedIn={false}
        />
      ))
      await screen.findByRole('heading', {
        name: "This sheet isn't shared right now",
      })
      const tabs = screen.getAllByRole('tab')
      expect(tabs.map((tab) => tab.textContent)).toEqual(['#all 1', '#home 1'])
      for (const tab of tabs)
        expect(tab).toHaveAttribute('aria-selected', 'false')
      const list = screen.getByRole('tablist')
      const title = screen.getByRole('heading', {
        name: "This sheet isn't shared right now",
      })
      expect(
        list.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    },
  )

  it('r8: the claimer keeps the standard C86 lock pill; C110 only in the caption', async () => {
    renderWithRouter(() => (
      <PublicBoard
        profile={{
          ...profile,
          sheets: { '': ON, fits: OFF },
          items: [
            sticker({
              id: 'mine',
              title: 'Samba OG',
              claimed: true,
              claimedByMe: true,
              shared: false,
            }),
          ],
        }}
        sheetId="fits"
        signedIn
      />
    ))
    await screen.findByText('Your claim is saved.')
    const pills = [...document.querySelectorAll('.nt-claimed')]
    expect(pills.length).toBeGreaterThan(0)
    for (const pill of pills) {
      expect(pill).not.toHaveAttribute('data-mine')
      expect(pill).toHaveTextContent(/^Claimed$/)
    }
    expect(document.querySelector('.nt-cap')).toHaveTextContent(
      'Claimed by you',
    )
  })

  it('r8: the claim sheet is a 440 modal at 1440 and drops "via shop link"', async () => {
    wide()
    renderWithRouter(() => (
      <PublicBoard
        profile={{
          ...profile,
          items: [sticker({ id: 'top', title: 'Raglan sweatshirt' })],
        }}
        sheetId={null}
        signedIn
      />
    ))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /^Raglan sweatshirt/ }))[0],
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Claim Raglan sweatshirt',
    })
    expect(dialog).toHaveClass('nt-modal', 'nt-claim-layer')
    expect(dialog.querySelector('.nt-grab')).toBeNull()
    expect(dialog).not.toHaveTextContent('via shop link')
    expect(dialog).toHaveTextContent('Fits · shop.example')
  })

  it.each(['x', 'escape', 'scrim'])(
    'r9: the 1440 claim modal has a 42 close X; %s closes it',
    async (how) => {
      wide()
      renderWithRouter(() => (
        <PublicBoard
          profile={{
            ...profile,
            items: [sticker({ id: 'top', title: 'Raglan sweatshirt' })],
          }}
          sheetId={null}
          signedIn
        />
      ))
      fireEvent.click(
        (
          await screen.findAllByRole('button', { name: /^Raglan sweatshirt/ })
        )[0],
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Claim Raglan sweatshirt',
      })
      const close = within(dialog).getByRole('button', { name: 'Close' })
      expect(close).toHaveClass('nt-ib', 'nt-claim-x')
      if (how === 'x') fireEvent.click(close)
      if (how === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' })
      if (how === 'scrim') {
        const scrim = document.querySelector('.nt-scrim')
        if (!scrim) throw new Error('no scrim')
        fireEvent.pointerDown(scrim)
        fireEvent.pointerUp(scrim)
        fireEvent.click(scrim)
      }
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Claim Raglan sweatshirt' }),
        ).toBeNull(),
      )
    },
  )
})

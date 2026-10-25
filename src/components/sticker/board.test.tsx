import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { StickerBoard } from './board'
import type { StickerBoardProps } from './board'
import { category, item } from '../../../test/fixtures'
import { renderWithRouter } from '../../../test/router'
import { setMediaMatches } from '../../../test/setup'
import type { GuestItem } from '#/lib/guest-wishlist'

const fits = category('Fits', 'fits')
const home = category('Home', 'home')
const shoe = item({ id: 'shoe', title: 'Samba OG', categoryId: fits.id })
const lamp = item({ id: 'lamp', title: 'Desk lamp', categoryId: home.id })
const old = item({
  id: 'old',
  title: 'Old tee',
  categoryId: fits.id,
  status: 'purchased',
  purchasedAt: Date.now() - 1000,
})

function setup(overrides: Partial<StickerBoardProps> = {}) {
  const onSetGot = vi.fn<StickerBoardProps['onSetGot']>()
  function Harness() {
    const [items, setItems] = useState<Array<GuestItem>>([shoe, lamp, old])
    return (
      <StickerBoard
        items={items}
        categories={[fits, home]}
        status="ready"
        onRetry={() => {}}
        user={{ name: 'Sean Motanya', username: 'sean', image: null }}
        origin="https://needthat.test"
        layout="stacks"
        onLayout={() => {}}
        settings={{ showPrices: true, allowClaims: true }}
        onSettings={() => {}}
        onSetGot={async (target, got) => {
          await onSetGot(target, got)
          setItems((current) =>
            current.map((entry) =>
              entry.id === target.id
                ? {
                    ...entry,
                    status: got ? 'purchased' : 'unresolved',
                    purchasedAt: got ? Date.now() : null,
                  }
                : entry,
            ),
          )
        }}
        onPrint={async () => {}}
        onCreateCategory={async () => 'nope'}
        onReorder={async () => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onSearch={() => {}}
        onSignOut={() => {}}
        {...overrides}
      />
    )
  }
  renderWithRouter(() => <Harness />)
  return { onSetGot }
}

afterEach(() => setMediaMatches(['(prefers-reduced-motion: reduce)']))

describe('StickerBoard (390)', () => {
  it('shows a tab per tag with its wanted count', async () => {
    setup()
    const tabs = await screen.findByRole('tablist', { name: 'Sheets' })
    expect(
      within(tabs).getByRole('tab', { name: '#all 2' }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('tab', { name: '#fits 1' }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('tab', { name: '#home 1' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
  })

  it('peels the open sticker with G and calls onSetGot', async () => {
    const { onSetGot } = setup()
    fireEvent.click(await screen.findByRole('button', { name: /^Samba OG/ }))
    await screen.findByRole('button', { name: /Peel off · Got it/ })
    fireEvent.keyDown(window, { key: 'g' })
    await waitFor(() =>
      expect(onSetGot).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shoe' }),
        true,
      ),
    )
  })

  it('says so and offers Retry when saving the peel fails', async () => {
    const { onSetGot } = setup()
    onSetGot.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(await screen.findByRole('button', { name: /^Samba OG/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Peel off · Got it/ }),
    )
    expect(
      await screen.findByText(
        "Couldn't save. Try again",
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('StickerBoard (1440)', () => {
  it('renders the Got sheet with its count', async () => {
    setMediaMatches(['(prefers-reduced-motion: reduce)', '(min-width: 768px)'])
    setup()
    const gotSheet = await waitFor(() => {
      const element = document.getElementById('nt-got-sheet')
      if (!element) throw new Error('no got sheet')
      return element
    })
    expect(within(gotSheet).getByText('THE GOT PAGE')).toBeInTheDocument()
    expect(
      within(gotSheet).getByRole('button', { name: /^Old tee/ }),
    ).toBeInTheDocument()
  })
})

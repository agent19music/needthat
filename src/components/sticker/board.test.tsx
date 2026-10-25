import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { StickerBoard, deskRows } from './board'
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
        sheetShares={{}}
        onShareSettings={() => {}}
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
    expect(within(gotSheet).getByText('GOT PAGE')).toBeInTheDocument()
    expect(
      within(gotSheet).getByRole('button', { name: /^Old tee/ }),
    ).toBeInTheDocument()
  })
})

describe('deskRows', () => {
  const tag = (key: string, unsorted = false) =>
    ({ key, unsorted, stickers: [] }) as unknown as Parameters<
      typeof deskRows
    >[0][number]
  const kinds = (rows: ReturnType<typeof deskRows>) =>
    rows.map((row) =>
      row.map(
        (cell) =>
          `${typeof cell.sheet === 'string' ? cell.sheet : cell.sheet.key}:${cell.kind}`,
      ),
    )

  it('≥1200: first sheet wide, the rest two-up, Got row with the #unsorted tile', () => {
    const rows = deskRows(
      [tag('desk'), tag('fits'), tag('football'), tag('u', true)],
      [],
      true,
    )
    expect(kinds(rows)).toEqual([
      ['desk:wide'],
      ['fits:half', 'football:half'],
      ['got:got-row', 'u:tile'],
    ])
  })

  it('768–1199 band (B1·07): every sheet two-up incl. #unsorted, Got full width', () => {
    const rows = deskRows(
      [tag('desk'), tag('fits'), tag('football'), tag('u', true)],
      [],
      true,
      true,
    )
    expect(kinds(rows)).toEqual([
      ['desk:half', 'fits:half'],
      ['football:half', 'u:half'],
      ['got:got-wide'],
    ])
  })

  it('band: an odd sheet out goes full width; blank sheets stay tiles', () => {
    const rows = deskRows(
      [tag('desk'), tag('fits'), tag('home')],
      [tag('b1'), tag('b2')],
      true,
      true,
    )
    expect(kinds(rows)).toEqual([
      ['desk:half', 'fits:half'],
      ['home:wide'],
      ['got:got-wide'],
      ['b1:tile', 'b2:tile'],
    ])
  })

  it('band without Got has no Got row', () => {
    expect(kinds(deskRows([tag('a'), tag('b')], [], false, true))).toEqual([
      ['a:half', 'b:half'],
    ])
  })
})

const WIDE = ['(prefers-reduced-motion: reduce)', '(min-width: 768px)']
const NOW = Date.now()

describe('r7: the owner sees who claimed (Q1)', () => {
  it('C86 badge and C104 caption, the name cut at 12 + "…"', async () => {
    setMediaMatches(WIDE)
    setup({
      claims: { shoe: { name: 'Wanjiru Kamau-Otieno', at: NOW } },
    })
    expect((await screen.findAllByText('Claimed')).length).toBeGreaterThan(0)
    const captions = screen.getAllByText('Claimed by Wanjiru Kama…')
    expect(captions.length).toBeGreaterThan(0)
    for (const caption of captions)
      expect(caption.textContent.length).toBeLessThanOrEqual(24)
  })

  it('C106 when the claimer has no display name', async () => {
    setMediaMatches(WIDE)
    setup({ claims: { shoe: { name: null, at: NOW } } })
    expect(
      (await screen.findAllByText('Claimed by a friend')).length,
    ).toBeGreaterThan(0)
  })

  it('C104 at 390 too', async () => {
    setup({ claims: { shoe: { name: 'Achieng', at: NOW } } })
    expect(
      (await screen.findAllByText('Claimed by Achieng')).length,
    ).toBeGreaterThan(0)
  })

  it('C105 in the item detail: full name and date', async () => {
    setMediaMatches(WIDE)
    setup({ claims: { shoe: { name: 'Achieng Otieno', at: NOW } } })
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /^Samba OG/ }))[0],
    )
    const line = await screen.findByText(/^Claimed by Achieng Otieno on /)
    expect(line.textContent.length).toBeLessThanOrEqual(40)
    expect(line.textContent).not.toMatch(/\d{4}/)
  })

  it('no claim, no caption', async () => {
    setMediaMatches(WIDE)
    setup()
    await screen.findByRole('tablist', { name: 'Sheets' })
    expect(screen.queryByText(/^Claimed by/)).toBeNull()
  })
})

describe('r7: account menu (Profile, Saved sizes, Currency, Sign out)', () => {
  it('1440 dropdown has no Sharing row', async () => {
    setMediaMatches(WIDE)
    setup()
    const trigger = await screen.findByRole('button', { name: 'Account menu' })
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((entry) => entry.textContent.trim())).toEqual([
      'Profile',
      'Saved sizes',
      expect.stringMatching(/^Currency/),
      'Sign out',
    ])
    expect(screen.queryByText('Sharing')).toBeNull()
  })

  it('390 sheet lists the same four rows', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    const nav = await screen.findByRole('navigation', { name: 'Account' })
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/account',
    )
    expect(within(nav).getByText('Saved sizes')).toBeInTheDocument()
    expect(within(nav).getByText('Currency')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByText('Sharing')).toBeNull()
  })
})

describe('r7: cover note (C11 bio, C12 FOR line)', () => {
  it('shows the bio and FOR line on the 1440 cover', async () => {
    setMediaMatches(WIDE)
    setup({ profile: { bio: 'Coffee, film and gear', forLine: 'Birthday' } })
    expect(await screen.findByText('Coffee, film and gear')).toBeInTheDocument()
    expect(document.querySelector('.nt-cover-for')).toHaveTextContent(
      'For Birthday',
    )
  })

  it('prompts for a bio when empty', async () => {
    setMediaMatches(WIDE)
    setup({ profile: { bio: '', forLine: '' } })
    expect(
      await screen.findByRole('link', { name: 'Add a short bio' }),
    ).toHaveAttribute('href', '/account')
  })
})

describe('r7: guest cover (C60 to C63)', () => {
  it('1440', async () => {
    setMediaMatches(WIDE)
    setup({ user: null })
    expect(
      await screen.findByRole('heading', { name: 'Your stickers' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Saved on this device only')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Sign in to save them' }),
    ).toHaveAttribute('href', '/sign-in')
    expect(screen.getByText('Sharing needs an account')).toBeInTheDocument()
  })

  it('390', async () => {
    setup({ user: null })
    expect(
      await screen.findByRole('heading', { name: 'Your stickers' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Saved on this device only')).toBeInTheDocument()
  })
})

describe('r7: final copy', () => {
  it('sort menu: C29 title, C32/C33 labels, C35 footnote (390)', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: /^Sort:/ }))
    expect(await screen.findAllByText('Sort stickers')).not.toHaveLength(0)
    expect(screen.getByText('Price: high to low')).toBeInTheDocument()
    expect(screen.getByText('Price: low to high')).toBeInTheDocument()
    expect(screen.getByText('Applies to all your sheets')).toBeInTheDocument()
  })

  it('empty account: C87 and C88 (1440)', async () => {
    setMediaMatches(WIDE)
    function Empty() {
      return (
        <StickerBoard
          items={[]}
          categories={[]}
          status="ready"
          onRetry={() => {}}
          user={{ name: 'Sean Motanya', username: 'sean', image: null }}
          origin="https://needthat.test"
          layout="stacks"
          onLayout={() => {}}
          sheetShares={{}}
          onShareSettings={() => {}}
          onSetGot={async () => {}}
          onPrint={async () => {}}
          onCreateCategory={async () => 'nope'}
          onReorder={async () => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onSearch={() => {}}
          onSignOut={() => {}}
        />
      )
    }
    renderWithRouter(() => <Empty />)
    expect(await screen.findByText('No stickers yet')).toBeInTheDocument()
    expect(
      screen.getByText('Paste a link to something you want or search by name.'),
    ).toBeInTheDocument()
  })
})

describe('r7: C14 per sheet', () => {
  const priced = (id: string, categoryId: string, amount: number) =>
    item({
      id,
      title: id,
      categoryId,
      price: { amount, currency: 'USD' },
    })

  it('count-only on a sheet with Show prices off, total on the others', async () => {
    setMediaMatches(WIDE)
    function Priced() {
      return (
        <StickerBoard
          items={[priced('tee', fits.id, 2500), priced('mug', home.id, 1200)]}
          categories={[fits, home]}
          status="ready"
          onRetry={() => {}}
          user={{ name: 'Sean Motanya', username: 'sean', image: null }}
          origin="https://needthat.test"
          layout="stacks"
          onLayout={() => {}}
          sheetShares={{
            [fits.id]: { showPrices: false, allowClaims: true, sharing: true },
          }}
          onShareSettings={() => {}}
          onSetGot={async () => {}}
          onPrint={async () => {}}
          onCreateCategory={async () => 'nope'}
          onReorder={async () => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onSearch={() => {}}
          onSignOut={() => {}}
        />
      )
    }
    renderWithRouter(() => <Priced />)
    expect(await screen.findAllByText(/^1 sticker · \$12/)).not.toHaveLength(0)
    expect(screen.queryAllByText(/^1 sticker · \$25/)).toHaveLength(0)
  })
})

describe('r9: Share all sheets → Stop sharing → Undo (Bau)', () => {
  it('Undo restores each sheet to its own earlier state and never writes the switches', async () => {
    setMediaMatches(WIDE)
    const initial: StickerBoardProps['sheetShares'] = {
      '': { showPrices: false, allowClaims: true, sharing: true },
      [fits.id]: { showPrices: true, allowClaims: false, sharing: true },
      [home.id]: { showPrices: true, allowClaims: true, sharing: false },
    }
    const patches: Array<[Array<string>, object]> = []
    let latest = initial
    function Harness() {
      const [shares, setShares] = useState(initial)
      latest = shares
      return (
        <StickerBoard
          items={[shoe, lamp]}
          categories={[fits, home]}
          status="ready"
          onRetry={() => {}}
          user={{ name: 'Sean Motanya', username: 'sean', image: null }}
          origin="https://needthat.test"
          layout="stacks"
          onLayout={() => {}}
          sheetShares={shares}
          onShareSettings={() => {
            throw new Error('Stop/Undo must not use onShareSettings')
          }}
          onSharePatch={(keys, patch) => {
            patches.push([keys, patch])
            setShares((current) => {
              const next = { ...current }
              for (const key of keys) next[key] = { ...current[key], ...patch }
              return next
            })
          }}
          onSetGot={async () => {}}
          onPrint={async () => {}}
          onCreateCategory={async () => 'nope'}
          onReorder={async () => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onSearch={() => {}}
          onSignOut={() => {}}
        />
      )
    }
    renderWithRouter(() => <Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }))
    const trigger = await screen.findByRole('button', {
      name: 'More share options',
    })
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Stop sharing' }),
    )
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('Stopped sharing your stickers')
    expect(patches).toEqual([[['', fits.id, home.id], { sharing: false }]])
    await waitFor(() =>
      expect(Object.values(latest).every((entry) => !entry.sharing)).toBe(true),
    )
    fireEvent.click(
      within(toast).getByRole('button', { name: 'Undo', hidden: true }),
    )
    // Only the sheets that were sharing come back; home stays stopped.
    expect(patches[1]).toEqual([['', fits.id], { sharing: true }])
    expect(patches).toHaveLength(2)
    await waitFor(() => expect(latest).toEqual(initial))
  })
})

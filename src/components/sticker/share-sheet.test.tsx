import { describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import { ShareSheet } from './share-sheet'
import {
  SHARE_AGAIN,
  STOPPED_LINE,
  STOPPED_ALL_TOAST,
  STOPPED_TITLE,
  STOPPED_TOAST,
} from '#/lib/sticker/claim-copy'
import type { ShareSettings } from './share-sheet'
import { item } from '../../../test/fixtures'

function setup(
  settings: ShareSettings,
  extra: {
    onToast?: (message: string, undo?: () => void) => void
    wide?: boolean
    sheetId?: string | null
    onShareAll?: () => void
    onOnlySheet?: () => void
    onStop?: () => () => void
  } = {},
) {
  const onSettings = vi.fn<(next: ShareSettings) => void>()
  render(
    <ShareSheet
      target={{
        sheetId: extra.sheetId ?? null,
        keys: extra.sheetId ? [extra.sheetId] : ['', 'fits'],
        tag: extra.sheetId ? `#${extra.sheetId}` : '#all',
        fill: 'blue',
        stickers: [item()],
        total: null,
      }}
      username="sean"
      name="Sean Motanya"
      origin="https://needthat.test"
      settings={settings}
      onSettings={onSettings}
      onClose={() => {}}
      onToast={() => {}}
      {...extra}
    />,
  )
  return { onSettings }
}

function openMenu() {
  const trigger = screen.getByRole('button', { name: 'More share options' })
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
}

describe('ShareSheet "…" menu (B3·02)', () => {
  it('hides New link entirely and keeps Stop sharing last', async () => {
    setup({ showPrices: true, allowClaims: true, sharing: true })
    openMenu()
    const items = await screen.findAllByRole('menuitem')
    const names = items.map((entry) => entry.textContent)
    expect(names).toEqual(['Preview public page', 'Stop sharing'])
    expect(screen.queryByText('New link')).toBeNull()
  })

  it('Stop sharing acts at once (no confirm), turns sharing off and toasts a 5s Undo', async () => {
    const onToast = vi.fn<(message: string, undo?: () => void) => void>()
    const { onSettings } = setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { onToast, wide: true, sheetId: 'fits' },
    )
    openMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Stop sharing' }),
    )
    expect(screen.queryByRole('dialog', { name: 'Stop sharing' })).toBeNull()
    expect(document.querySelector('.nt-confirm')).toBeNull()
    expect(onSettings).toHaveBeenLastCalledWith({
      showPrices: true,
      allowClaims: true,
      sharing: false,
    })
    expect(onToast).toHaveBeenCalledWith(
      'Stopped sharing this sheet',
      expect.any(Function),
    )
    onToast.mock.calls[0][1]?.()
    expect(onSettings).toHaveBeenLastCalledWith({
      showPrices: true,
      allowClaims: true,
      sharing: true,
    })
  })

  it('Stop sharing keeps the other switches as they were', async () => {
    const { onSettings } = setup(
      { showPrices: false, allowClaims: true, sharing: true },
      { wide: true },
    )
    openMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Stop sharing' }),
    )
    expect(onSettings).toHaveBeenLastCalledWith({
      showPrices: false,
      allowClaims: true,
      sharing: false,
    })
  })

  it('C102: a single sheet offers Share all sheets', async () => {
    const onShareAll = vi.fn()
    setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { sheetId: 'fits', onShareAll, onOnlySheet: vi.fn() },
    )
    openMenu()
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((entry) => entry.textContent)).toEqual([
      'Share all sheets',
      'Preview public page',
      'Stop sharing',
    ])
    fireEvent.click(items[0])
    expect(onShareAll).toHaveBeenCalled()
  })

  it('C102: sharing all offers Only this sheet to go back', async () => {
    const onOnlySheet = vi.fn()
    setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { onShareAll: vi.fn(), onOnlySheet },
    )
    openMenu()
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((entry) => entry.textContent)).toEqual([
      'Only this sheet',
      'Preview public page',
      'Stop sharing',
    ])
    fireEvent.click(items[0])
    expect(onOnlySheet).toHaveBeenCalled()
  })

  it('Preview links to the one sheet when sharing one', async () => {
    setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { sheetId: 'fits' },
    )
    openMenu()
    expect(
      await screen.findByRole('menuitem', { name: 'Preview public page' }),
    ).toHaveAttribute('href', '/u/sean?sheet=fits')
  })

  it('stopped (wide): card at 40%, the link field becomes the off line, Copy link becomes Share again', () => {
    const { onSettings } = setup(
      { showPrices: true, allowClaims: true, sharing: false },
      { wide: true },
    )
    expect(
      document.querySelector('.nt-share-card[data-off="true"]'),
    ).not.toBeNull()
    expect(document.querySelector('.nt-share-field')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    const off = document.querySelector('.nt-share-off')
    expect(off?.querySelector('.nt-share-off-text')).toHaveTextContent(
      'Your link is turned off',
    )
    expect(off?.querySelector('.nt-share-off-sub')).toHaveTextContent(
      STOPPED_LINE,
    )
    expect(within(off as HTMLElement).getByRole('button')).toHaveTextContent(
      'Share again',
    )
    fireEvent.click(within(off as HTMLElement).getByRole('button'))
    expect(onSettings).toHaveBeenCalledWith({
      showPrices: true,
      allowClaims: true,
      sharing: true,
    })
  })

  it('sharing on (wide): full card and the link field with Copy link', () => {
    setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { wide: true },
    )
    expect(document.querySelector('.nt-share-card[data-off]')).toBeNull()
    expect(document.querySelector('.nt-share-field')).toHaveTextContent(
      'needthat.test/u/sean',
    )
    expect(
      screen.getByRole('button', { name: 'Copy link' }),
    ).toBeInTheDocument()
  })

  it('stopped (390): Stop sharing is disabled and Share again turns the page back on', async () => {
    const { onSettings } = setup({
      showPrices: true,
      allowClaims: true,
      sharing: false,
    })
    openMenu()
    expect(
      await screen.findByRole('menuitem', { name: 'Stop sharing' }),
    ).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Share again' }))
    await waitFor(() =>
      expect(onSettings).toHaveBeenCalledWith({
        showPrices: true,
        allowClaims: true,
        sharing: true,
      }),
    )
  })

  it.each([true, false])(
    'stopped (wide=%s): Story, Message, Save image and both toggles are disabled; Share again is the only live control',
    (wide) => {
      setup({ showPrices: true, allowClaims: true, sharing: false }, { wide })
      for (const name of ['Story', 'Message', 'Save image'])
        expect(screen.getByRole('button', { name })).toBeDisabled()
      for (const name of ['Show prices', 'Friends can claim'])
        expect(screen.getByRole('switch', { name })).toBeDisabled()
      const live = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '.nt-share-act, .nt-toggle, .nt-share-off button',
        ),
      ].filter((button) => !button.disabled)
      expect(live.map((button) => button.textContent.trim())).toEqual([
        SHARE_AGAIN,
      ])
    },
  )

  it('sharing on: the acts and toggles are live', () => {
    setup({ showPrices: true, allowClaims: true, sharing: true })
    for (const name of ['Story', 'Message', 'Save image'])
      expect(screen.getByRole('button', { name })).toBeEnabled()
    expect(screen.getByRole('switch', { name: 'Show prices' })).toBeEnabled()
    expect(document.querySelector('.nt-share-off-line')).toBeNull()
  })

  it('stopped (390): the off title and C109 under the faded card', () => {
    setup({ showPrices: true, allowClaims: true, sharing: false })
    const line = document.querySelector('.nt-share-off-line')
    expect(line?.querySelector('b')).toHaveTextContent(STOPPED_TITLE)
    expect(line?.querySelector('small')).toHaveTextContent(STOPPED_LINE)
    expect(line?.previousElementSibling).toHaveAttribute('data-off', 'true')
  })

  it('stopped (wide): no extra line (the off line replaces the link field)', () => {
    setup(
      { showPrices: true, allowClaims: true, sharing: false },
      { wide: true },
    )
    expect(document.querySelector('.nt-share-off-line')).toBeNull()
  })
})

describe('stopped copy (Addendum 1, C109)', () => {
  it('uses the final strings', () => {
    expect(STOPPED_TITLE).toBe('Your link is turned off')
    expect(SHARE_AGAIN).toBe('Share again')
    expect(STOPPED_TOAST).toBe('Stopped sharing this sheet')
    expect(STOPPED_LINE).not.toMatch(/TBD/)
  })
})

describe('r8 share sheet', () => {
  it('1440 tiles match the 390 order: Message / Story / Save image', () => {
    setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { wide: true },
    )
    const tiles = [...document.querySelectorAll('.nt-share-acts button')].map(
      (button) => button.textContent.trim(),
    )
    expect(tiles).toEqual(['Message', 'Story', 'Save image'])
  })

  it('the switch reads "Friends can claim"', () => {
    setup({ showPrices: true, allowClaims: true, sharing: true })
    expect(
      screen.getByRole('switch', { name: 'Friends can claim' }),
    ).toBeInTheDocument()
  })

  it('Stop sharing on Share all sheets uses onStop and its Undo, never onSettings', async () => {
    const undo = vi.fn()
    const onStop = vi.fn(() => undo)
    const onToast = vi.fn<(message: string, undo?: () => void) => void>()
    const { onSettings } = setup(
      { showPrices: false, allowClaims: true, sharing: true },
      { onStop, onToast },
    )
    openMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Stop sharing' }),
    )
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onSettings).not.toHaveBeenCalled()
    expect(onToast).toHaveBeenCalledWith(STOPPED_ALL_TOAST, undo)
  })
})

describe('r9 share sheet', () => {
  it.each([
    [null, 'Stopped sharing your stickers'],
    ['fits', 'Stopped sharing this sheet'],
  ])('Stop sharing toast for sheetId=%s reads "%s"', async (sheetId, text) => {
    const onToast = vi.fn<(message: string, undo?: () => void) => void>()
    setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { onToast, sheetId, onStop: () => () => {} },
    )
    openMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Stop sharing' }),
    )
    expect(onToast).toHaveBeenCalledWith(text, expect.any(Function))
  })

  it('the #all card: plural kicker and the C98 count, no prices', () => {
    render(
      <ShareSheet
        target={{
          sheetId: null,
          keys: ['', 'fits', 'home'],
          tag: '#all',
          fill: 'blue',
          stickers: [
            item({
              id: 'a',
              categoryId: 'fits',
              price: { amount: 100, currency: 'USD' },
            }),
            item({
              id: 'b',
              categoryId: 'fits',
              price: { amount: 50, currency: 'USD' },
            }),
            item({
              id: 'c',
              categoryId: 'home',
              price: { amount: 20, currency: 'USD' },
            }),
            item({
              id: 'd',
              categoryId: null,
              price: { amount: 10, currency: 'USD' },
            }),
            item({
              id: 'e',
              categoryId: 'home',
              price: { amount: 5, currency: 'USD' },
            }),
          ],
          total: '$185',
        }}
        username="wanjiru_qa"
        name="Wanjiru Kamau"
        origin="https://needthat.test"
        settings={{ showPrices: true, allowClaims: true, sharing: true }}
        onSettings={() => {}}
        onClose={() => {}}
        onToast={() => {}}
      />,
    )
    const head = document.querySelector('.nt-card-head')
    expect(head?.querySelector('.nt-kicker')).toHaveTextContent(
      "Wanjiru's sheets · @wanjiru_qa",
    )
    expect(head?.querySelector('p')).toHaveTextContent(
      /^5 stickers · 3 sheets$/,
    )
  })

  it('one sheet keeps the singular kicker and the C14 line with its total', () => {
    render(
      <ShareSheet
        target={{
          sheetId: 'fits',
          keys: ['fits'],
          tag: '#fits',
          fill: 'blue',
          stickers: [
            item({
              id: 'a',
              categoryId: 'fits',
              price: { amount: 100, currency: 'USD' },
            }),
          ],
          total: '$100',
        }}
        username="wanjiru_qa"
        name="Wanjiru Kamau"
        origin="https://needthat.test"
        settings={{ showPrices: true, allowClaims: true, sharing: true }}
        onSettings={() => {}}
        onClose={() => {}}
        onToast={() => {}}
      />,
    )
    const head = document.querySelector('.nt-card-head')
    expect(head?.querySelector('.nt-kicker')).toHaveTextContent(
      "Wanjiru's sheet · @wanjiru_qa",
    )
    expect(head?.querySelector('p')).toHaveTextContent(/^1 sticker · \$100$/)
  })
})

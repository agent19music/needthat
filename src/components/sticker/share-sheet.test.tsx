import { describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import { COPY_TBD, ShareSheet } from './share-sheet'
import type { ShareSettings } from './share-sheet'
import { item } from '../../../test/fixtures'

function setup(
  settings: ShareSettings,
  extra: {
    onToast?: (message: string, undo?: () => void) => void
    wide?: boolean
  } = {},
) {
  const onSettings = vi.fn<(next: ShareSettings) => void>()
  render(
    <ShareSheet
      target={{
        sheetId: null,
        tag: '#all',
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

  it('Stop sharing confirms with [copy TBD], turns sharing off and toasts a 5s Undo', async () => {
    const onToast = vi.fn<(message: string, undo?: () => void) => void>()
    const { onSettings } = setup(
      { showPrices: true, allowClaims: true, sharing: true },
      { onToast, wide: true },
    )
    openMenu()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Stop sharing' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Stop sharing' })
    expect(dialog).toHaveClass('nt-modal', 'nt-confirm')
    expect(dialog).toHaveTextContent(COPY_TBD)
    expect(onSettings).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }))
    expect(onSettings).toHaveBeenLastCalledWith({
      showPrices: true,
      allowClaims: true,
      sharing: false,
    })
    expect(onToast).toHaveBeenCalledWith(COPY_TBD, expect.any(Function))
    onToast.mock.calls[0][1]?.()
    expect(onSettings).toHaveBeenLastCalledWith({
      showPrices: true,
      allowClaims: true,
      sharing: true,
    })
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
    expect(off).toHaveTextContent(`${COPY_TBD}${COPY_TBD}`)
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
    fireEvent.click(screen.getByRole('button', { name: COPY_TBD }))
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
      for (const name of ['Show prices', 'Friends can claim stickers'])
        expect(screen.getByRole('switch', { name })).toBeDisabled()
      const live = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '.nt-share-act, .nt-toggle, .nt-share-off button',
        ),
      ].filter((button) => !button.disabled)
      expect(live.map((button) => button.textContent.trim())).toEqual([
        COPY_TBD,
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

  it('stopped (390): one [copy TBD] line under the faded card', () => {
    setup({ showPrices: true, allowClaims: true, sharing: false })
    const line = document.querySelector('.nt-share-off-line')
    expect(line).toHaveTextContent(COPY_TBD)
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

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { ItemPanel } from './item-panel'
import { item } from '../../../test/fixtures'
import { MONTHS } from '../../lib/sticker/sheets'

const shoe = item({
  id: 'shoe',
  title: 'Samba OG',
  categoryId: 'fits',
  sourceUrl: 'https://shop.test/samba',
  price: { amount: 10000, currency: 'USD' },
})

const lamp = item({ id: 'lamp', title: 'Lamp', categoryId: 'fits' })

function setup(wide: boolean, target = shoe) {
  const calls = {
    onMove: vi.fn(),
    onEditPrice: vi.fn(),
    onCopyLink: vi.fn(),
    onPrintSticker: vi.fn(),
    onPeel: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
  }
  render(
    <ItemPanel
      item={target}
      sheet={{
        fill: 'green',
        tag: '#fits',
        number: 1,
        stickers: [target, lamp],
      }}
      now={Date.now()}
      showPrice
      onClose={() => {}}
      onUnpeel={() => {}}
      onArrange={() => {}}
      onOpen={() => {}}
      onSeeSheet={() => {}}
      onShare={() => {}}
      moveTargets={[
        { id: 'fits', tag: '#fits' },
        { id: 'home', tag: '#home' },
        { id: null, tag: 'No category' },
      ]}
      wide={wide}
      {...calls}
    />,
  )
  return calls
}

function moreWide() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
}

describe('ItemPanel overflow (B2·04, 1440)', () => {
  it('lists the shared item menu in order, with red Remove after a divider', async () => {
    setup(true)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    })
    const menu = await screen.findByRole('menu')
    const names = within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent.trim())
    expect(names).toEqual([
      'Edit details',
      'Edit price',
      'Move to sheet',
      'Copy item link',
      'Arrange sheet',
      'Remove',
    ])
    const remove = within(menu).getByRole('menuitem', { name: 'Remove' })
    expect(remove).toHaveAttribute('data-tone', 'red')
    expect(remove.previousElementSibling).toHaveAttribute('role', 'separator')
    expect(
      screen.getByRole('button', { name: /Peel off/, hidden: true }),
    ).toBeInTheDocument()
  })

  it('Move opens a centred modal with the sheets as radios', async () => {
    const calls = setup(true)
    moreWide()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Move to sheet' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Move to sheet' })
    expect(dialog).toHaveClass('nt-modal', 'nt-move')
    expect(
      within(dialog).getByRole('radio', { name: '#fits' }),
    ).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByRole('radio', { name: '#home' }))
    expect(calls.onMove).toHaveBeenCalledWith(shoe, 'home')
  })

  it('Edit price and Copy item link call through', async () => {
    const calls = setup(true)
    const more = () =>
      fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), {
        button: 0,
        ctrlKey: false,
        pointerType: 'mouse',
      })
    more()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit price' }))
    expect(calls.onEditPrice).toHaveBeenCalledWith(shoe)
    more()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Copy item link' }),
    )
    expect(calls.onCopyLink).toHaveBeenCalledWith(shoe)
  })

  it('Edit details opens the editor', async () => {
    const calls = setup(true)
    moreWide()
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Edit details' }),
    )
    expect(calls.onEdit).toHaveBeenCalledWith(shoe)
  })

  it('wide: no Mark as got in the menu (Peel off · Got it is in the bar)', async () => {
    setup(true)
    moreWide()
    const menu = await screen.findByRole('menu')
    expect(
      within(menu).queryByRole('menuitem', { name: 'Mark as got' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /Peel off/, hidden: true }),
    ).toBeInTheDocument()
  })

  it('has the white Print sticker pill in the bottom bar', () => {
    const calls = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Print sticker' }))
    expect(calls.onPrintSticker).toHaveBeenCalledWith(shoe)
  })
})

describe('ItemPanel overflow (B2·05, 390)', () => {
  it('opens the sheet with the shared item menu, Remove last (r9, B2·05)', async () => {
    const calls = setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const menu = await screen.findByRole('menu', { name: 'More' })
    const names = within(menu)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent.trim())
    // r8 (Bau): Edit details leads the 390 menu too, matching 1440.
    expect(names).toEqual([
      'Edit details',
      'Edit price',
      'Move to sheet',
      'Copy item link',
      'Arrange sheet',
      'Remove',
    ])
    // r9: the rows scroll inside the sheet; the header stays outside.
    expect(menu).toHaveClass('nt-ovf-list')
    expect(menu.closest('.nt-ovf-sheet')).not.toBeNull()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Remove' }))
    expect(calls.onDelete).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Delete sticker', hidden: true }),
    ).toBeInTheDocument()
  })

  it('no Mark as got in the 390 menu (Peel off · Got it is in the bar)', async () => {
    setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const menu = await screen.findByRole('menu', { name: 'More' })
    expect(
      within(menu).queryByRole('menuitem', { name: 'Mark as got' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /Peel off/, hidden: true }),
    ).toBeInTheDocument()
  })

  it('r8: Edit details leads the 390 sheet and calls through', async () => {
    const calls = setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Edit details' }),
    )
    expect(calls.onEdit).toHaveBeenCalledWith(shoe)
  })

  it('Edit price calls through and closes the sheet', async () => {
    const calls = setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit price' }))
    expect(calls.onEditPrice).toHaveBeenCalledWith(shoe)
  })

  it('Move to sheet opens a bottom sheet with the current sheet checked, and moves', async () => {
    const calls = setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Move to sheet' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Move to sheet' })
    expect(dialog).toHaveClass('nt-bottom', 'nt-move')
    expect(dialog).not.toHaveClass('nt-modal')
    const current = await screen.findByRole('radio', { name: '#fits' })
    expect(current).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'No category' }))
    expect(calls.onMove).toHaveBeenCalledWith(shoe, null)
  })

  it.each([true, false])(
    'Added chip drops the year in the current year (wide=%s)',
    (wide) => {
      const today = new Date()
      today.setHours(12)
      setup(wide, { ...shoe, createdAt: today.getTime() })
      const day = `${today.getDate()} ${MONTHS[today.getMonth()]}`
      expect(
        screen.getByText(/^Added/, { selector: '.nt-chip' }),
      ).toHaveTextContent(new RegExp(`^Added ?${day}$`))
    },
  )

  it('Added chip keeps the year for an older year', () => {
    setup(true)
    const year = new Date(shoe.createdAt).getFullYear()
    expect(
      screen.getByText(/^Added/, { selector: '.nt-chip' }),
    ).toHaveTextContent(new RegExp(` ${year}$`))
  })
})

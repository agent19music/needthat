import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { StacksView } from './stacks-view'
import { category, item } from '../../../test/fixtures'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

const fits = category('Fits')
const home = category('Home')

function Harness(props: {
  items: Array<GuestItem>
  categories?: Array<GuestCategory>
  ready?: boolean
  onReorder?: (ids: Array<string>) => Promise<void>
  onRemove?: (item: GuestItem) => void
  onAdd?: (id: string | null) => void
  onSave?: (item: GuestItem) => Promise<void>
}) {
  const [items, setItems] = useState(props.items)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <StacksView
      items={items}
      categories={props.categories ?? [fits, home]}
      ready={props.ready ?? true}
      selectedCategoryId={selected}
      onSelectCategory={setSelected}
      onToggleGot={async (target) => {
        setItems((current) =>
          current.map((entry) =>
            entry.id === target.id
              ? {
                  ...entry,
                  status:
                    entry.status === 'purchased' ? 'unresolved' : 'purchased',
                  purchasedAt: entry.status === 'purchased' ? null : Date.now(),
                }
              : entry,
          ),
        )
      }}
      onSave={async (next) => {
        await props.onSave?.(next)
        setItems((current) =>
          current.map((entry) => (entry.id === next.id ? next : entry)),
        )
      }}
      onRemove={(target) => {
        props.onRemove?.(target)
        setItems((current) => current.filter((entry) => entry.id !== target.id))
      }}
      onReorder={props.onReorder ?? (async () => {})}
      onAdd={props.onAdd ?? (() => {})}
      onNewCategory={() => {}}
      onCreateCategory={async (name) => category(name)}
      onChangeImage={() => {}}
      now={new Date(2026, 9, 23).getTime()}
    />
  )
}

function fitsItems() {
  return [
    item({
      title: 'Samba OG',
      brand: 'adidas',
      categoryId: fits.id,
      position: 0,
      sourceUrl: 'https://www.adidas.com/samba',
      price: { amount: 12000, currency: 'USD' },
    }),
    item({ title: 'Field jacket', categoryId: fits.id, position: 1 }),
    item({ title: 'Wool beanie', categoryId: fits.id, position: 2 }),
    item({ title: 'Lamp', categoryId: home.id, position: 3 }),
  ]
}

describe('StacksView overview', () => {
  it('shows a skeleton while loading', () => {
    render(<Harness items={[]} ready={false} />)
    expect(
      screen.getByRole('list', { name: 'Loading stacks' }),
    ).toHaveAttribute('aria-busy', 'true')
  })
  it('shows the empty profile when there is nothing at all', () => {
    render(<Harness items={[]} categories={[]} />)
    expect(screen.getByText('Nothing stacked yet')).toBeInTheDocument()
  })
  it('renders one pile per stack plus empty and new tiles', () => {
    const gifts = category('Gifts')
    render(<Harness items={fitsItems()} categories={[fits, home, gifts]} />)
    const grid = screen.getByRole('list', { name: 'Stacks' })
    expect(
      within(grid).getByRole('button', { name: '#fits, 3 items, $120' }),
    ).toBeInTheDocument()
    expect(
      within(grid).getByRole('button', { name: '#home, 1 item' }),
    ).toBeInTheDocument()
    expect(
      within(grid).getByRole('button', { name: /#gifts, empty/ }),
    ).toBeInTheDocument()
    expect(
      within(grid).getByRole('button', { name: 'New stack' }),
    ).toBeInTheDocument()
  })
  it('opening an empty stack focuses the add flow for it', () => {
    const onAdd = vi.fn()
    const gifts = category('Gifts')
    render(
      <Harness items={fitsItems()} categories={[fits, gifts]} onAdd={onAdd} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /#gifts, empty/ }))
    expect(onAdd).toHaveBeenCalledWith(gifts.id)
  })
})

describe('StacksView strip', () => {
  function openFits() {
    render(<Harness items={fitsItems()} />)
    fireEvent.click(screen.getByRole('button', { name: /#fits/ }))
  }

  it('opens a stack as a strip with the position header', () => {
    openFits()
    expect(screen.getByRole('heading', { name: '#fits' })).toBeInTheDocument()
    expect(screen.getByText('1 / 3 · $120')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Add to #fits/ }),
    ).toBeInTheDocument()
  })
  it('arrow keys move focus and announce the card', () => {
    openFits()
    const current = document.querySelector<HTMLButtonElement>(
      '[aria-current="true"]',
    )!
    current.focus()
    fireEvent.keyDown(current, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 3 · $120')).toBeInTheDocument()
    expect(screen.getByText('Field jacket, 2 of 3')).toBeInTheDocument()
    fireEvent.keyDown(document.querySelector('[aria-current="true"]')!, {
      key: 'ArrowLeft',
    })
    expect(screen.getByText('1 / 3 · $120')).toBeInTheDocument()
  })
  it('Esc goes back to the overview', () => {
    openFits()
    fireEvent.keyDown(document.querySelector('[aria-current="true"]')!, {
      key: 'Escape',
    })
    expect(screen.getByRole('list', { name: 'Stacks' })).toBeInTheDocument()
  })
  it('G marks the focused card got, stamps it and offers undo', async () => {
    openFits()
    fireEvent.keyDown(document.querySelector('[aria-current="true"]')!, {
      key: 'g',
    })
    await screen.findByText('Moved to Got. Nice.', {}, { timeout: 2000 })
    expect(
      screen.getByText('Moved to Got. Undo available.'),
    ).toBeInTheDocument()
    // The got card moves behind the wanted ones and keeps its stamp.
    expect(screen.getByText('Got · 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.getByText('Got · 0')).toBeInTheDocument())
  })
  it('Enter opens the detail sheet with the item facts', async () => {
    openFits()
    fireEvent.keyDown(document.querySelector('[aria-current="true"]')!, {
      key: 'Enter',
    })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Samba OG')).toBeInTheDocument()
    expect(within(dialog).getByText(/adidas\.com/)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /Got it/ }),
    ).toBeInTheDocument()
  })
  it('deleting from the sheet asks first, then removes', async () => {
    const onRemove = vi.fn()
    render(<Harness items={fitsItems()} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: /#fits/ }))
    fireEvent.keyDown(document.querySelector('[aria-current="true"]')!, {
      key: 'Enter',
    })
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Delete/ }))
    expect(onRemove).not.toHaveBeenCalled()
    const confirm = within(dialog).getByRole('group', {
      name: 'Delete this item?',
    })
    fireEvent.click(within(confirm).getByRole('button', { name: /Delete/ }))
    expect(onRemove).toHaveBeenCalledOnce()
  })
  it('E opens the editor and saving keeps the item in place', async () => {
    const onSave = vi.fn(async (_item: unknown) => {})
    render(<Harness items={fitsItems()} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /#fits/ }))
    fireEvent.keyDown(document.querySelector('[aria-current="true"]')!, {
      key: 'e',
    })
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByRole('textbox', { name: /Name/ })
    fireEvent.change(name, { target: { value: 'Samba OG black' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save/ }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: 'Samba OG black',
      categoryId: fits.id,
    })
  })
  it('the other-stacks row switches stack', () => {
    openFits()
    fireEvent.click(screen.getByRole('button', { name: /#home/ }))
    expect(screen.getByRole('heading', { name: '#home' })).toBeInTheDocument()
  })
})

describe('StacksView arrange', () => {
  it('keyboard reorder: Space picks up, arrows move, Space drops, Done saves', async () => {
    const onReorder = vi.fn(async () => {})
    const items = fitsItems()
    render(<Harness items={items} onReorder={onReorder} />)
    fireEvent.click(screen.getByRole('button', { name: /#fits/ }))
    fireEvent.click(screen.getByRole('button', { name: /Arrange/ }))
    const first = screen.getByRole('button', {
      name: 'Samba OG, position 1 of 3',
    })
    fireEvent.keyDown(first, { key: ' ' })
    expect(
      screen.getByText('Picked up Samba OG, position 1 of 3.'),
    ).toBeInTheDocument()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Samba OG, position 2 of 3' }),
      { key: ' ' },
    )
    expect(
      screen.getByText('Dropped Samba OG at position 2 of 3.'),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Done/ }))
    })
    expect(onReorder).toHaveBeenCalledWith([
      items[1].id,
      items[0].id,
      items[2].id,
    ])
  })
  it('only one card is ever lifted and every card keeps its own slot', () => {
    render(<Harness items={fitsItems()} />)
    fireEvent.click(screen.getByRole('button', { name: /#fits/ }))
    fireEvent.click(screen.getByRole('button', { name: /Arrange/ }))
    const first = screen.getByRole('button', { name: /Samba OG/ })
    fireEvent.keyDown(first, { key: ' ' })
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.querySelectorAll('[data-lifted]')).toHaveLength(1)
    expect(document.querySelectorAll('.stk-arrange-slot')).toHaveLength(3)
  })
  it('Esc while lifted restores the original order', () => {
    render(<Harness items={fitsItems()} />)
    fireEvent.click(screen.getByRole('button', { name: /#fits/ }))
    fireEvent.click(screen.getByRole('button', { name: /Arrange/ }))
    const first = screen.getByRole('button', { name: /Samba OG/ })
    fireEvent.keyDown(first, { key: ' ' })
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('button', { name: /Samba OG/ }), {
      key: 'Escape',
    })
    expect(
      screen.getByRole('button', { name: 'Samba OG, position 1 of 3' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Reorder cancelled.')).toBeInTheDocument()
  })
  it('a failed save keeps arrange open with an error', async () => {
    render(
      <Harness
        items={fitsItems()}
        onReorder={async () => {
          throw new Error('nope')
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /#fits/ }))
    fireEvent.click(screen.getByRole('button', { name: /Arrange/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Done/ }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'That order could not be saved.',
    )
    expect(screen.getByRole('button', { name: /Done/ })).toBeInTheDocument()
  })
})

describe('Got pile', () => {
  it('shows got items with the year caption and opens them as a strip', () => {
    const got = item({
      title: 'Kettle',
      status: 'purchased',
      purchasedAt: new Date(2026, 4, 2).getTime(),
      categoryId: home.id,
    })
    render(<Harness items={[...fitsItems(), got]} />)
    expect(screen.getByText('1 · this year')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Got/ }))
    expect(screen.getByRole('heading', { name: 'Got' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add/ })).toBeNull()
  })
})

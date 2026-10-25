import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Pile } from './pile'
import { item } from '../../../test/fixtures'

const three = () => [
  item({ title: 'A' }),
  item({ title: 'B' }),
  item({ title: 'C' }),
  item({ title: 'D' }),
]

describe('Pile', () => {
  it('labels the pile with tag, count and total', () => {
    render(
      <Pile
        variant="default"
        tag="#fits"
        items={three()}
        total="$400"
        onOpen={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: '#fits, 4 items, $400' }),
    ).toBeInTheDocument()
    expect(screen.getByText('4 · $400')).toBeInTheDocument()
  })
  it('hides the total when no item has an offer', () => {
    render(
      <Pile variant="default" tag="#fits" items={three()} onOpen={() => {}} />,
    )
    expect(
      screen.getByRole('button', { name: '#fits, 4 items' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/\$/)).toBeNull()
  })
  it('renders at most three cards', () => {
    const { container } = render(
      <Pile variant="default" tag="#fits" items={three()} onOpen={() => {}} />,
    )
    expect(container.querySelectorAll('.stk-card')).toHaveLength(3)
  })
  it('never shows a price on a card without an offer', () => {
    const { container } = render(
      <Pile
        variant="default"
        tag="#fits"
        items={[item({ price: { amount: 9900, currency: 'USD' } }), item()]}
        onOpen={() => {}}
      />,
    )
    expect(container.querySelectorAll('.stk-row .stk-mono')).toHaveLength(1)
  })
  it('fans on mouse hover but never on touch (mobile clipping fix)', () => {
    const { container } = render(
      <Pile variant="default" tag="#fits" items={three()} onOpen={() => {}} />,
    )
    const tile = container.querySelector('.stk-tile')!
    const hit = screen.getByRole('button')
    fireEvent.pointerEnter(hit, { pointerType: 'touch' })
    expect(tile).toHaveAttribute('data-state', 'rest')
    fireEvent.pointerEnter(hit, { pointerType: 'mouse' })
    expect(tile).toHaveAttribute('data-state', 'hover')
    fireEvent.pointerLeave(hit)
    expect(tile).toHaveAttribute('data-state', 'rest')
  })
  it('opens on click', () => {
    const onOpen = vi.fn()
    render(
      <Pile variant="default" tag="#fits" items={three()} onOpen={onOpen} />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledOnce()
  })
  it('a mouse drag past the slop starts a drag of the top card and suppresses the click', () => {
    const items = three()
    const onOpen = vi.fn()
    const onDragItem = vi.fn()
    render(
      <Pile
        variant="default"
        tag="#fits"
        items={items}
        onOpen={onOpen}
        onDragItem={onDragItem}
      />,
    )
    const hit = screen.getByRole('button')
    fireEvent.pointerDown(hit, {
      button: 0,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
    })
    fireEvent.pointerMove(hit, { clientX: 3, clientY: 0, pointerType: 'mouse' })
    expect(onDragItem).not.toHaveBeenCalled()
    fireEvent.pointerMove(hit, {
      clientX: 20,
      clientY: 0,
      pointerType: 'mouse',
    })
    expect(onDragItem).toHaveBeenCalledWith(items[0], expect.anything())
    fireEvent.click(hit)
    expect(onOpen).not.toHaveBeenCalled()
  })
  it('a quick touch move scrolls instead of dragging', () => {
    const onDragItem = vi.fn()
    render(
      <Pile
        variant="default"
        tag="#fits"
        items={three()}
        onOpen={() => {}}
        onDragItem={onDragItem}
      />,
    )
    const hit = screen.getByRole('button')
    fireEvent.pointerDown(hit, {
      button: 0,
      clientX: 0,
      clientY: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(hit, {
      clientX: 0,
      clientY: 40,
      pointerType: 'touch',
    })
    expect(onDragItem).not.toHaveBeenCalled()
  })
  it('the dragged card leaves the pile and the count drops', () => {
    const items = three()
    render(
      <Pile
        variant="default"
        tag="#fits"
        items={items}
        dragSourceId={items[0].id}
        onOpen={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: '#fits, 3 items' }),
    ).toBeInTheDocument()
  })
  it('empty, got and new variants use the copy from the design', () => {
    const { rerender } = render(
      <Pile variant="empty" tag="#gifts" onOpen={() => {}} />,
    )
    expect(screen.getByText(/Nothing in #gifts yet\./)).toBeInTheDocument()
    expect(screen.getByText('empty')).toBeInTheDocument()
    rerender(
      <Pile
        variant="got"
        tag="Got"
        items={[item({ status: 'purchased', purchasedAt: 1 })]}
        count={3}
        caption="this year"
        onOpen={() => {}}
      />,
    )
    expect(screen.getByText('3 · this year')).toBeInTheDocument()
    rerender(<Pile variant="new" tag="" onOpen={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'New stack' }),
    ).toBeInTheDocument()
    expect(screen.getByText('name it with a hashtag')).toBeInTheDocument()
  })
  it('marks a drop target', () => {
    const { container } = render(
      <Pile
        variant="default"
        tag="#fits"
        items={three()}
        dropId="c1"
        dropActive
        onOpen={() => {}}
      />,
    )
    expect(container.querySelector('.stk-tile')).toHaveAttribute(
      'data-state',
      'drop',
    )
    expect(container.querySelector('.stk-tile')).toHaveAttribute(
      'data-drop-category',
      'c1',
    )
  })
})

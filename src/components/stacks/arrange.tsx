import { useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { CardFace } from '#/components/stacks/pile-card'
import { instant, t } from '#/components/stacks/tokens'
import { slotFromPointer } from '#/lib/stacks/stacks'
import { moveIndex } from '#/lib/wishlist/order'
import type { GuestItem } from '#/lib/guest-wishlist'

/**
 * Arrange mode: the stack laid flat in a row. The lifted card always sits
 * in a real slot of the flow (the neighbours make room for it), so it can
 * never overlap its neighbour mid-drag; the insertion bar marks the slot.
 *
 * Keyboard: Space picks up, ←/→ moves, Space drops, Esc cancels.
 */
export function Arrange({
  items,
  order,
  onOrder,
  onCancel,
}: {
  items: ReadonlyArray<GuestItem>
  order: ReadonlyArray<string>
  onOrder: (order: Array<string>) => void
  onCancel: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const byId = new Map(items.map((item) => [item.id, item]))
  const [lifted, setLifted] = useState<string | null>(null)
  const [mode, setMode] = useState<'pointer' | 'keyboard' | null>(null)
  const [status, setStatus] = useState('')
  const start = useRef<{ order: Array<string>; centres: Array<number> } | null>(
    null,
  )
  const refs = useRef(new Map<string, HTMLElement>())

  function pick(id: string, via: 'pointer' | 'keyboard') {
    const centres = order.map((entry) => {
      const rect = refs.current.get(entry)?.getBoundingClientRect()
      return rect ? rect.left + rect.width / 2 : 0
    })
    start.current = { order: [...order], centres }
    setLifted(id)
    setMode(via)
    const item = byId.get(id)
    setStatus(
      `Picked up ${item?.title ?? 'item'}, position ${order.indexOf(id) + 1} of ${order.length}.`,
    )
  }

  function drop() {
    const item = lifted ? byId.get(lifted) : undefined
    if (lifted)
      setStatus(
        `Dropped ${item?.title ?? 'item'} at position ${order.indexOf(lifted) + 1} of ${order.length}.`,
      )
    setLifted(null)
    setMode(null)
    start.current = null
  }

  function cancel() {
    if (start.current) onOrder(start.current.order)
    setStatus('Reorder cancelled.')
    setLifted(null)
    setMode(null)
    start.current = null
  }

  function moveTo(id: string, slot: number) {
    const from = order.indexOf(id)
    if (from < 0 || from === slot) return
    onOrder(moveIndex([...order], from, slot))
    setStatus(`Position ${slot + 1} of ${order.length}.`)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      if (lifted === id) drop()
      else pick(id, 'keyboard')
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      if (lifted === id)
        moveTo(
          id,
          Math.max(0, Math.min(order.length - 1, order.indexOf(id) + delta)),
        )
      else {
        const next = order[order.indexOf(id) + delta]
        if (next) refs.current.get(next)?.querySelector('button')?.focus()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (lifted) cancel()
      else onCancel()
    }
  }

  function onPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pick(id, 'pointer')
  }

  function onPointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) {
    if (lifted !== id || mode !== 'pointer' || !start.current) return
    moveTo(id, slotFromPointer(event.clientX, start.current.centres))
  }

  return (
    <div className="stk-arrange">
      <ol className="stk-arrange-row" aria-label="Arrange items">
        {order.map((id) => {
          const item = byId.get(id)
          if (!item) return null
          const isLifted = lifted === id
          return (
            <motion.li
              key={id}
              layout={!reduced}
              transition={reduced ? instant : t.spring.responsive}
              ref={(node: HTMLLIElement | null) => {
                if (node) refs.current.set(id, node)
                else refs.current.delete(id)
              }}
              className="stk-arrange-slot"
              data-lifted={isLifted || undefined}
            >
              <motion.button
                type="button"
                className="stk-card"
                aria-label={`${item.title}, position ${order.indexOf(id) + 1} of ${order.length}`}
                aria-pressed={isLifted}
                animate={
                  isLifted && !reduced
                    ? { scale: 1.04, rotate: 2 }
                    : { scale: 1, rotate: 0 }
                }
                transition={reduced ? instant : t.spring.responsive}
                onKeyDown={(event) => onKeyDown(event, id)}
                onPointerDown={(event) => onPointerDown(event, id)}
                onPointerMove={(event) => onPointerMove(event, id)}
                onPointerUp={() => {
                  if (mode === 'pointer') drop()
                }}
                onPointerCancel={() => {
                  if (mode === 'pointer') cancel()
                }}
              >
                <CardFace item={item} />
              </motion.button>
            </motion.li>
          )
        })}
      </ol>
      <p className="stk-keys" data-static aria-hidden="true">
        <span>
          <kbd>Space</kbd> pick up
        </span>
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> move
        </span>
        <span>
          <kbd>Space</kbd> drop
        </span>
        <span>
          <kbd>Esc</kbd> cancel
        </span>
      </p>
      <p className="sr-only" aria-live="assertive">
        {status}
      </p>
    </div>
  )
}

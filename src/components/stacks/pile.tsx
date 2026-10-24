import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { LinkSimpleIcon, PlusIcon } from '@phosphor-icons/react'

import { PileCard } from '#/components/stacks/pile-card'
import { instant, t } from '#/components/stacks/tokens'
import { PILE_DEPTH, pileAriaLabel } from '#/lib/stacks/stacks'
import type { GuestItem } from '#/lib/guest-wishlist'

export type PileVariant = 'default' | 'got' | 'empty' | 'new'

/** Movement (px) before a press on the top card becomes a drag. */
const DRAG_SLOP = 6
/** Touch must hold this long before dragging, so scrolling still works. */
const TOUCH_HOLD_MS = 300

export function Pile({
  variant,
  tag,
  items = [],
  count = items.length,
  total = null,
  caption,
  dropId,
  dropActive = false,
  dragSourceId = null,
  bump = 0,
  onOpen,
  onDragItem,
}: {
  variant: PileVariant
  tag: string
  items?: ReadonlyArray<GuestItem>
  count?: number
  total?: string | null
  caption?: string
  /** Category id this pile accepts drops for (overview move). */
  dropId?: string
  dropActive?: boolean
  /** Item being dragged out of this pile: rendered one card short. */
  dragSourceId?: string | null
  /** Increment to play the 1 → 1.12 → 1 bump. */
  bump?: number
  onOpen: () => void
  onDragItem?: (item: GuestItem, event: ReactPointerEvent) => void
}) {
  const reduced = useReducedMotion() ?? false
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const press = useRef<{
    x: number
    y: number
    at: number
    pointerType: string
    dragged: boolean
  } | null>(null)

  const shown = items.filter((item) => item.id !== dragSourceId)
  const visibleCount = dragSourceId ? count - 1 : count
  const cards = shown.slice(0, PILE_DEPTH)
  // Fan only for a real hover or keyboard focus. Touch never fans, which
  // keeps the ±36px side cards inside the 2-column mobile tile.
  const fanned = (hovered || focused) && cards.length > 1

  const label =
    variant === 'new'
      ? 'New stack'
      : variant === 'empty'
        ? `${tag}, empty. Paste a link`
        : pileAriaLabel(tag, visibleCount, total)

  const meta =
    variant === 'got'
      ? [String(visibleCount), caption].filter(Boolean).join(' · ')
      : variant === 'default'
        ? [String(visibleCount), total].filter(Boolean).join(' · ')
        : null

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!onDragItem || cards.length === 0 || event.button !== 0) return
    press.current = {
      x: event.clientX,
      y: event.clientY,
      at: Date.now(),
      pointerType: event.pointerType,
      dragged: false,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = press.current
    if (!start || start.dragged || !onDragItem) return
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (moved < DRAG_SLOP) return
    if (
      start.pointerType !== 'mouse' &&
      Date.now() - start.at < TOUCH_HOLD_MS
    ) {
      press.current = null
      return
    }
    start.dragged = true
    setHovered(false)
    onDragItem(cards[0], event)
  }

  return (
    <div
      className="stk-tile"
      data-variant={variant}
      data-state={dropActive ? 'drop' : fanned ? 'hover' : 'rest'}
      data-drop-category={dropId}
    >
      <button
        type="button"
        className="stk-tile-hit"
        aria-label={label}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setHovered(true)
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setFocused(true)
        }}
        onBlur={() => setFocused(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          window.setTimeout(() => {
            press.current = null
          }, 0)
        }}
        onClick={(event) => {
          if (press.current?.dragged) {
            event.preventDefault()
            return
          }
          onOpen()
        }}
      />
      <motion.span
        className="stk-pile"
        aria-hidden="true"
        key={bump}
        initial={false}
        animate={bump > 0 && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={
          reduced ? instant : { duration: t.d.standard, ease: t.ease.standard }
        }
      >
        {variant === 'empty' ? (
          <span className="stk-ghost">
            <LinkSimpleIcon size={20} aria-hidden="true" />
            <span>
              Nothing in {tag} yet.
              <br />
              Paste a link to start the pile.
            </span>
          </span>
        ) : variant === 'new' ? (
          <span className="stk-ghost" data-new>
            <PlusIcon size={20} aria-hidden="true" />
            New stack
          </span>
        ) : (
          cards
            .map((item, depth) => (
              <PileCard
                key={item.id}
                item={item}
                depth={depth}
                fanned={fanned}
              />
            ))
            .reverse()
        )}
      </motion.span>
      <span className="stk-label" aria-hidden="true">
        <span className="stk-label-tag">{variant === 'new' ? '#…' : tag}</span>
        <span className="stk-label-meta">
          {variant === 'new'
            ? 'name it with a hashtag'
            : variant === 'empty'
              ? 'empty'
              : meta}
        </span>
      </span>
    </div>
  )
}

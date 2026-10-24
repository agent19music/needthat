import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react'

import { StripCard } from '#/components/stacks/strip-card'
import type { GotPhase } from '#/components/stacks/strip-card'
import { MOBILE_QUERY, useMedia } from '#/components/stacks/use-media'
import { useReducedMotion } from 'motion/react'
import {
  GOT_TIMELINE,
  addedLabel,
  hostOf,
  stripAnnouncement,
} from '#/lib/stacks/stacks'
import type { GuestItem } from '#/lib/guest-wishlist'

const SWIPE_PX = 50
const FLICK_UP_PX = 80
const WHEEL_PX = 40

/**
 * The opened stack: focused card plus neighbours, pips, keyboard hints and
 * the details row. Keys (on the focused card): ←/→ move, Enter opens the
 * sheet, G marks Got it, E edits, Esc goes back to Stacks.
 */
export function Strip({
  items,
  focusIndex,
  onFocusIndex,
  readOnly = false,
  footer,
  onBack,
  onOpen,
  onGot,
  onEdit,
}: {
  items: ReadonlyArray<GuestItem>
  focusIndex: number
  onFocusIndex: (index: number) => void
  readOnly?: boolean
  footer?: ReactNode
  onBack: () => void
  onOpen: (item: GuestItem) => void
  /** Called once the Got-it animation finishes. */
  onGot: (item: GuestItem) => void
  onEdit: (item: GuestItem) => void
}) {
  const mobile = useMedia(MOBILE_QUERY)
  const reduced = useReducedMotion() ?? false
  const [gotting, setGotting] = useState<{
    id: string
    phase: GotPhase
  } | null>(null)
  const [flyTo, setFlyTo] = useState({ x: 420, y: 260 })
  const focusedRef = useRef<HTMLButtonElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null)
  const wheel = useRef(0)
  const timers = useRef<Array<number>>([])
  const hadFocus = useRef(false)
  const swiped = useRef(false)

  const index = Math.max(0, Math.min(items.length - 1, focusIndex))
  const focused = items.at(index)

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer)
    },
    [],
  )

  useEffect(() => {
    if (index !== focusIndex && items.length > 0) onFocusIndex(index)
  }, [index, focusIndex, items.length, onFocusIndex])

  useEffect(() => {
    // Keep keyboard focus on the focused card as the roving stop moves.
    if (hadFocus.current) focusedRef.current?.focus({ preventScroll: true })
  }, [index, items])

  function go(next: number) {
    if (items.length === 0) return
    onFocusIndex(Math.max(0, Math.min(items.length - 1, next)))
  }

  function gotIt(item: GuestItem) {
    if (readOnly || gotting || item.status === 'purchased') return
    const target = document.querySelector('[data-got-target]')
    const card = focusedRef.current
    if (target && card) {
      const from = card.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      setFlyTo({
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
      })
    }
    setGotting({ id: item.id, phase: 'stamp' })
    const flyAt = reduced ? 120 : GOT_TIMELINE.flyDelayMs
    const doneAt = reduced
      ? 240
      : GOT_TIMELINE.flyDelayMs + GOT_TIMELINE.flyS * 1000
    timers.current.push(
      window.setTimeout(() => setGotting({ id: item.id, phase: 'fly' }), flyAt),
      window.setTimeout(() => {
        setGotting(null)
        onGot(item)
      }, doneAt),
    )
  }

  function onCardKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!focused) return
    hadFocus.current = true
    const key = event.key
    if (key === 'ArrowRight') {
      event.preventDefault()
      go(index + 1)
    } else if (key === 'ArrowLeft') {
      event.preventDefault()
      go(index - 1)
    } else if (key === 'Enter') {
      event.preventDefault()
      onOpen(focused)
    } else if (
      (key === 'g' || key === 'G') &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault()
      gotIt(focused)
    } else if (
      (key === 'e' || key === 'E') &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      if (readOnly) return
      event.preventDefault()
      onEdit(focused)
    } else if (key === 'Escape') {
      event.preventDefault()
      onBack()
    }
  }

  return (
    <section className="stk-strip-wrap" aria-label="Stack">
      <div
        ref={boardRef}
        className="stk-board"
        data-mobile={mobile || undefined}
        onPointerDown={(event) => {
          swiped.current = false
          swipe.current = {
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
          }
        }}
        onPointerUp={(event) => {
          const start = swipe.current
          swipe.current = null
          if (!start || start.id !== event.pointerId) return
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
            swiped.current = true
            go(dx < 0 ? index + 1 : index - 1)
          } else if (
            event.pointerType !== 'mouse' &&
            dy < -FLICK_UP_PX &&
            Math.abs(dy) > Math.abs(dx) &&
            focused &&
            focusedRef.current?.contains(event.target as Node)
          ) {
            swiped.current = true
            gotIt(focused)
          }
        }}
        onWheel={(event) => {
          if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
          wheel.current += event.deltaX
          if (Math.abs(wheel.current) < WHEEL_PX) return
          go(wheel.current > 0 ? index + 1 : index - 1)
          wheel.current = 0
        }}
      >
        <p className="stk-frame" aria-hidden="true">
          {items.length > 0 ? `${index + 1} / ${items.length}` : ''}
        </p>
        <ul
          className="stk-strip"
          aria-label="Items"
          onFocus={() => (hadFocus.current = true)}
        >
          {items.map((item, itemIndex) => (
            <StripCard
              key={item.id}
              ref={itemIndex === index ? focusedRef : undefined}
              item={item}
              offset={itemIndex - index}
              mobile={mobile}
              phase={gotting?.id === item.id ? gotting.phase : null}
              flyTo={flyTo}
              onSelect={() => {
                if (swiped.current) {
                  swiped.current = false
                  return
                }
                if (itemIndex === index) onOpen(item)
                else go(itemIndex)
              }}
              onKeyDown={onCardKey}
            />
          ))}
        </ul>
        <div className="stk-ctrl">
          <button
            type="button"
            className="stk-round"
            aria-label="Previous"
            disabled={index <= 0}
            onClick={() => go(index - 1)}
          >
            <ArrowLeftIcon size={15} aria-hidden="true" />
          </button>
          <span className="stk-pips" aria-hidden="true">
            {items.map((item, itemIndex) => (
              <i key={item.id} data-on={itemIndex === index || undefined} />
            ))}
          </span>
          <button
            type="button"
            className="stk-round"
            aria-label="Next"
            disabled={index >= items.length - 1}
            onClick={() => go(index + 1)}
          >
            <ArrowRightIcon size={15} aria-hidden="true" />
          </button>
        </div>
        <p className="stk-keys" aria-hidden="true">
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> flick
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          {readOnly ? null : (
            <span>
              <kbd>G</kbd> got it
            </span>
          )}
          <span>
            <kbd>Esc</kbd> back
          </span>
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {stripAnnouncement(focused, index, items.length)}
      </p>
      {focused && !readOnly ? (
        <div className="stk-details">
          <dl>
            <div>
              <dt>Notes</dt>
              <dd>{focused.notes || '—'}</dd>
            </div>
            <div>
              <dt>Store</dt>
              <dd>
                {focused.sourceUrl ? (hostOf(focused.sourceUrl) ?? '—') : '—'}
              </dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>{addedLabel(focused.createdAt)}</dd>
            </div>
          </dl>
          <div className="stk-details-actions">
            <button
              type="button"
              className="stk-btn"
              onClick={() => onEdit(focused)}
            >
              Edit
            </button>
            <button
              type="button"
              className="stk-btn"
              data-primary
              disabled={focused.status === 'purchased' || gotting !== null}
              onClick={() => gotIt(focused)}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
      {footer}
    </section>
  )
}

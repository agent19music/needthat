import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { CardFace } from '#/components/stacks/pile-card'
import { instant, t } from '#/components/stacks/tokens'
import { stripSlot } from '#/lib/stacks/stacks'
import type { GuestItem } from '#/lib/guest-wishlist'

export type GotPhase = 'stamp' | 'fly' | null

/**
 * A PileCard at strip size. `offset` is the distance from the focused card;
 * the focused card carries aria-current and the roving tab stop.
 */
export const StripCard = forwardRef<
  HTMLButtonElement,
  {
    item: GuestItem
    offset: number
    mobile: boolean
    phase: GotPhase
    flyTo: { x: number; y: number }
    onSelect: () => void
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  }
>(function StripCard(
  { item, offset, mobile, phase, flyTo, onSelect, onKeyDown },
  ref,
) {
  const reduced = useReducedMotion() ?? false
  const slot = stripSlot(offset, mobile)
  const focused = offset === 0
  const got = item.status === 'purchased' || phase !== null

  const animate =
    phase === 'fly'
      ? reduced
        ? { opacity: 0 }
        : {
            x: slot.x + flyTo.x,
            y: flyTo.y,
            scale: 0.36,
            rotate: 8,
            opacity: [1, 1, 0],
          }
      : phase === 'stamp' && !reduced
        ? {
            x: slot.x,
            y: 0,
            rotate: slot.rotate,
            scale: [1, 1.14, 1],
            opacity: 1,
          }
        : {
            x: slot.x,
            y: 0,
            rotate: slot.rotate,
            scale: slot.scale,
            opacity: slot.visible ? 1 : 0,
          }

  const transition = reduced
    ? instant
    : phase === 'fly'
      ? {
          duration: t.d.considered,
          ease: t.ease.inOut,
          opacity: {
            duration: t.d.considered,
            times: [0, 0.75, 1],
          },
        }
      : phase === 'stamp'
        ? { scale: { duration: 0.18, delay: 0.12, times: [0, 0.5, 1] } }
        : t.spring.snappy

  return (
    <motion.li
      className="stk-strip-slot"
      role="presentation"
      initial={false}
      animate={animate}
      transition={transition}
      style={{
        zIndex: phase ? 20 : slot.zIndex,
        width: slot.width,
        height: slot.height,
        marginLeft: -slot.width / 2,
        top: focused ? 36 : 70,
        pointerEvents: slot.visible ? undefined : 'none',
      }}
      aria-hidden={!slot.visible || undefined}
    >
      <button
        ref={ref}
        type="button"
        className="stk-card"
        data-focused={focused || undefined}
        data-got={got || undefined}
        aria-current={focused ? 'true' : undefined}
        tabIndex={focused ? 0 : -1}
        aria-label={item.title}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <CardFace
          item={
            phase
              ? { ...item, status: 'purchased', purchasedAt: Date.now() }
              : item
          }
          freshStamp={phase !== null}
        />
      </button>
    </motion.li>
  )
})

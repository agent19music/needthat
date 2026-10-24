import { motion, useReducedMotion } from 'motion/react'

import { t } from '#/components/stacks/tokens'
import { stampText } from '#/lib/stacks/stacks'

/**
 * Red ink "GOT IT · DD.MM" stamp. `fresh` plays the Got-it entrance
 * (scale 1.6 → .94 → 1, opacity 0 → 1 over `standard`).
 */
export function GotStamp({
  date,
  fresh = false,
  size = 'md',
}: {
  date: number
  fresh?: boolean
  size?: 'sm' | 'md'
}) {
  const reduced = useReducedMotion()
  const text = stampText(date)
  if (!fresh)
    return (
      <span className="stk-stamp" data-size={size} aria-label={text}>
        {text}
      </span>
    )
  return (
    <motion.span
      className="stk-stamp"
      data-size={size}
      aria-label={text}
      initial={
        reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6, rotate: -12 }
      }
      animate={
        reduced
          ? { opacity: 1 }
          : { opacity: 1, scale: [1.6, 0.94, 1], rotate: -12 }
      }
      transition={{
        duration: reduced ? t.d.instant : t.d.standard,
        ease: t.ease.enter,
      }}
    >
      {text}
    </motion.span>
  )
}

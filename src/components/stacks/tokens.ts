import { motionTokens } from '#/components/arc/motion-tokens'

type Bezier = [number, number, number, number]

/** Arc motion tokens in the mutable shapes `motion` expects. */
export const t = {
  d: motionTokens.duration,
  ease: {
    enter: [...motionTokens.ease.enter] as Bezier,
    exit: [...motionTokens.ease.exit] as Bezier,
    standard: [...motionTokens.ease.standard] as Bezier,
    inOut: [...motionTokens.ease.inOut] as Bezier,
  },
  spring: {
    responsive: { ...motionTokens.spring.responsive },
    gentle: { ...motionTokens.spring.gentle },
    snappy: { ...motionTokens.spring.snappy },
    smooth: { ...motionTokens.spring.smooth },
    morph: { ...motionTokens.spring.morph },
  },
  stagger: motionTokens.stagger.item,
} as const

/** Reduced motion: every transition collapses to `instant` (≤120ms). */
export const instant = { duration: motionTokens.duration.instant }

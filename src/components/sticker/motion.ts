/**
 * Sticker Sheet motion (handoff §7). Every number the sticker look animates
 * with lives here so the feel can be tuned in one place. Durations are in
 * seconds (what `motion` expects); `GESTURE` is in px and px/s.
 */
import type { Transition } from 'motion/react'

type Bezier = [number, number, number, number]

export const EASE = {
  /** Fly arc: ease-out cubic. */
  out: [0.33, 1, 0.68, 1] as Bezier,
  enter: [0.16, 1, 0.3, 1] as Bezier,
  standard: [0.22, 1, 0.36, 1] as Bezier,
}

export const MOTION = {
  press: { scale: 0.96, duration: 0.09 },
  hover: { y: -2, duration: 0.16 },
  /** Peel start: the sticker lifts and tilts a further −8°. */
  lift: { scale: 1.06, rotate: -8, y: -8, duration: 0.16 },
  fly: { duration: 0.42, arc: 80, times: [0, 0.45, 1] },
  /** 390: the Got page rises from the bottom while the sticker flies. */
  pageRise: { duration: 0.3 },
  slap: { scale: [1.1, 0.98, 1], duration: 0.14 },
  burst: { delay: 0.06, scale: [0, 1.08, 1], rotate: -10, duration: 0.2, hold: 1.2, fade: 0.18 },
  label: { delay: 0.12, duration: 0.14 },
  print: { scale: [1.1, 1], duration: 0.14, star: 0.2 },
  claimed: { rotate: -7 },
  /** Reduced motion: opacity crossfades only. */
  reduced: { duration: 0.12 },
} as const

export const GESTURE = {
  /** Commit a peel past 72px up… */
  distance: 72,
  /** …or faster than 600px/s upward. */
  velocity: 600,
} as const

export const TOAST_MS = 6000

/** Peel commit rule (§5): far enough up, or flicked up fast enough. */
export function shouldCommitPeel(offsetY: number, velocityY: number) {
  return offsetY <= -GESTURE.distance || velocityY <= -GESTURE.velocity
}

type Point = { x: number; y: number }

/**
 * Arc keyframes from one point to another: x moves evenly, y rises 80px
 * above the higher end at 45% of the way, then lands.
 */
export function flyKeyframes(from: Point, to: Point) {
  const [, middle] = MOTION.fly.times
  return {
    x: [from.x, from.x + (to.x - from.x) * middle, to.x],
    y: [from.y, Math.min(from.y, to.y) - MOTION.fly.arc, to.y],
    times: [...MOTION.fly.times],
  }
}

export function flyTransition(reduced: boolean): Transition {
  if (reduced) return { duration: MOTION.reduced.duration }
  return {
    duration: MOTION.fly.duration,
    ease: EASE.out,
    times: [...MOTION.fly.times],
  }
}

export function slapTransition(reduced: boolean, delay = 0): Transition {
  if (reduced) return { duration: MOTION.reduced.duration, delay }
  return { duration: MOTION.slap.duration, ease: EASE.standard, delay }
}

/** Initial/animate pair for a sticker slapping on (print, claimed, landing). */
export function slapIn(reduced: boolean, rotate = 0) {
  return reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, scale: MOTION.slap.scale[0], rotate },
        animate: { opacity: 1, scale: [...MOTION.slap.scale], rotate },
      }
}

/** GOT IT! burst: pops in, holds, fades. Total ≈ 1.64s. */
export function burstAnimation(reduced: boolean) {
  const { delay, duration, hold, fade, rotate } = MOTION.burst
  if (reduced) {
    return {
      initial: { opacity: 0, rotate },
      animate: { opacity: [0, 1, 1, 0] },
      transition: {
        duration: MOTION.reduced.duration * 2 + hold,
        times: [0, 0.07, 0.93, 1],
      },
    }
  }
  const total = duration + hold + fade
  return {
    initial: { opacity: 0, scale: 0, rotate },
    animate: {
      opacity: [0, 1, 1, 1, 0],
      scale: [0, 1.08, 1, 1, 1],
      rotate,
    },
    transition: {
      delay,
      duration: total,
      times: [0, (duration * 0.6) / total, duration / total, (duration + hold) / total, 1],
      ease: EASE.standard,
    },
  }
}

export function burstTotalMs(reduced: boolean) {
  const { delay, duration, hold, fade } = MOTION.burst
  return Math.round(
    (reduced ? MOTION.reduced.duration * 2 + hold : delay + duration + hold + fade) * 1000,
  )
}

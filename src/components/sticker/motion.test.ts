import { describe, expect, it } from 'vitest'

import {
  GESTURE,
  MOTION,
  burstAnimation,
  burstTotalMs,
  flyKeyframes,
  flyTransition,
  shouldCommitPeel,
  slapIn,
} from './motion'

describe('peel commit', () => {
  it('commits past 72px up', () => {
    expect(shouldCommitPeel(-72, 0)).toBe(true)
    expect(shouldCommitPeel(-71, 0)).toBe(false)
  })

  it('commits on a fast upward flick', () => {
    expect(shouldCommitPeel(-10, -600)).toBe(true)
    expect(shouldCommitPeel(-10, -599)).toBe(false)
  })

  it('never commits downward drags', () => {
    expect(shouldCommitPeel(120, 900)).toBe(false)
    expect(GESTURE).toEqual({ distance: 72, velocity: 600 })
  })
})

describe('fly arc', () => {
  it('rises 80px above the higher end at 45%', () => {
    const frames = flyKeyframes({ x: 0, y: 300 }, { x: 200, y: 500 })
    expect(frames.y).toEqual([300, 220, 500])
    expect(frames.x).toEqual([0, 90, 200])
    expect(frames.times).toEqual([0, 0.45, 1])
  })

  it('uses 420ms ease-out, or a 120ms crossfade when reduced', () => {
    expect(flyTransition(false)).toMatchObject({
      duration: 0.42,
      ease: [0.33, 1, 0.68, 1],
    })
    expect(flyTransition(true)).toEqual({ duration: 0.12 })
  })
})

describe('slap and burst', () => {
  it('slaps 1.1 → .98 → 1, or only fades when reduced', () => {
    expect(slapIn(false).animate.scale).toEqual([1.1, 0.98, 1])
    expect(slapIn(true)).toEqual({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
    })
  })

  it('pops at −10°, holds 1.2s and fades in 180ms', () => {
    const burst = burstAnimation(false)
    expect(burst.initial.rotate).toBe(-10)
    expect(burst.transition.delay).toBe(MOTION.burst.delay)
    expect(burst.transition.duration).toBeCloseTo(1.58)
    expect(burstTotalMs(false)).toBe(1640)
    expect('scale' in burstAnimation(true).animate).toBe(false)
  })
})

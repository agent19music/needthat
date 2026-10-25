import { describe, expect, it } from 'vitest'

import { dotLeft, scaled } from './sheet'

describe('dotLeft (r3 dot inside the sheet edge)', () => {
  it('clamps the planned left between 8px in from each sheet edge', () => {
    const plan = { width: 1000 }
    const css = dotLeft(
      scaled(plan, 180),
      scaled(plan, 800),
      'max(4.4cqw, 44px)',
    )
    expect(css).toBe(
      'clamp(calc(8px - calc(0.80000 * 100cqw)), calc(0.18000 * 100cqw), ' +
        'calc(100cqw - calc(0.80000 * 100cqw) - max(4.4cqw, 44px) - 8px))',
    )
  })

  it('the max bound keeps the whole dot (its size) clear of the right edge', () => {
    const css = dotLeft('10px', '0px', '44px')
    expect(css).toMatch(/calc\(100cqw - 0px - 44px - 8px\)\)$/)
    expect(css.startsWith('clamp(calc(8px - 0px), 10px,')).toBe(true)
  })
})

// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'

import { reportAspect, useAspects } from './aspects'

function Probe({ onRender }: { onRender: (ratio: number | null) => void }) {
  const item = { id: 'late', imageUrl: null }
  const aspectOf = useAspects([item])
  onRender(aspectOf(item))
  return null
}

describe('r8 aspects store', () => {
  it('re-renders for an aspect reported before the hook subscribed', () => {
    const seen: Array<number | null> = []
    // Reported in an earlier sibling's effect, i.e. after Probe rendered but
    // before it subscribed (a cached image at hydration).
    function Early() {
      useEffect(() => reportAspect({ id: 'late', imageUrl: null }, 2), [])
      return null
    }
    act(() => {
      render(
        <>
          <Early />
          <Probe onRender={(ratio) => seen.push(ratio)} />
        </>,
      )
    })
    expect(seen[0]).toBeNull()
    expect(seen.at(-1)).toBe(2)
  })
})

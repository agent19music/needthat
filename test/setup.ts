import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// Reduced motion by default makes motion transitions instant and tests deterministic.
// Individual tests can override window.matchMedia.
const queries = new Set(['(prefers-reduced-motion: reduce)'])
export function setMediaMatches(next: Array<string>) {
  queries.clear()
  next.forEach((query) => queries.add(query))
}
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: queries.has(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  Object.assign(globalThis, {
    ResizeObserver: Observer,
    IntersectionObserver: Observer,
  })
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.scrollIntoView = vi.fn()
}

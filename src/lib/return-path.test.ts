import { describe, expect, it } from 'vitest'

import { returnPath } from './return-path'

describe('returnPath', () => {
  it('allows a public sheet', () => {
    expect(returnPath('/u/sean')).toBe('/u/sean')
    expect(returnPath('/u/sean?sheet=abc-123')).toBe('/u/sean?sheet=abc-123')
  })

  it('refuses anything else', () => {
    expect(returnPath('https://evil.example/u/sean')).toBeNull()
    expect(returnPath('//evil.example')).toBeNull()
    expect(returnPath('/account')).toBeNull()
    expect(returnPath(42)).toBeNull()
  })
})

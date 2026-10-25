import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SHARE,
  anyShared,
  linkDescription,
  linkTitle,
  shareFor,
  shareForTarget,
  sheetKey,
  wasSharing,
} from './sheet-share'

const ON = { showPrices: true, allowClaims: true, sharing: true }

describe('per-sheet share settings (Q3)', () => {
  it('new sheets default to both switches on and shared', () => {
    expect(DEFAULT_SHARE).toEqual(ON)
    expect(shareFor({}, 'fits')).toEqual(ON)
  })

  it('#unsorted is the empty key', () => {
    expect(sheetKey(null)).toBe('')
    expect(sheetKey(undefined)).toBe('')
    expect(sheetKey('fits')).toBe('fits')
    expect(shareFor({ '': { ...ON, sharing: false } }, null).sharing).toBe(
      false,
    )
  })

  it('a target reads on only when every sheet has the switch on', () => {
    const sheets = {
      fits: { ...ON, showPrices: false },
      desk: ON,
    }
    expect(shareForTarget(sheets, ['fits', 'desk'])).toEqual({
      ...ON,
      showPrices: false,
    })
    expect(shareForTarget(sheets, ['desk'])).toEqual(ON)
    expect(shareForTarget(sheets, [])).toEqual(ON)
  })

  it('r8: the whole list reads shared while any sheet shares', () => {
    const mixed = { fits: ON, home: { ...ON, sharing: false } }
    expect(shareForTarget(mixed, ['fits', 'home']).sharing).toBe(true)
    const off = {
      fits: { ...ON, sharing: false },
      home: { ...ON, sharing: false },
    }
    expect(shareForTarget(off, ['fits', 'home']).sharing).toBe(false)
  })

  it('anyShared ignores stopped sheets', () => {
    const sheets = {
      fits: { ...ON, sharing: false },
      desk: { ...ON, allowClaims: false },
    }
    expect(anyShared(sheets, ['fits', 'desk'], 'allowClaims')).toBe(false)
    expect(anyShared(sheets, ['fits', 'desk'], 'showPrices')).toBe(true)
    expect(anyShared(sheets, [], 'showPrices')).toBe(false)
  })
})

describe('X5 link text', () => {
  it('title', () => {
    expect(linkTitle('Sean')).toBe("Sean's wishlist on needthat")
  })

  it('description keeps the claim sentence while any shared sheet allows it', () => {
    expect(linkDescription(15, 5, true)).toBe(
      '15 stickers across 5 sheets. Friends can claim an item to buy it as a gift.',
    )
  })

  it('drops the second sentence when no shared sheet allows claiming', () => {
    expect(linkDescription(1, 1, false)).toBe('1 sticker across 1 sheet.')
  })
})

describe('wasSharing (r8, Share all sheets Undo)', () => {
  it('keeps only the sheets that are sharing now, so Undo restores each', () => {
    const shares = {
      fits: { ...DEFAULT_SHARE, sharing: true, showPrices: false },
      home: { ...DEFAULT_SHARE, sharing: false },
    }
    expect(wasSharing(shares, ['', 'fits', 'home'])).toEqual(['', 'fits'])
  })
})

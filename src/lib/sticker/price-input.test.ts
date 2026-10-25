import { describe, expect, it } from 'vitest'

import {
  MAX_CENTS,
  amountText,
  currencySymbol,
  parseAmount,
} from '#/lib/sticker/price-input'

describe('parseAmount', () => {
  it.each([
    ['50', 5000],
    ['85.5', 8550],
    ['85.50', 8550],
    ['1,250', 125000],
    [' 1 250.99 ', 125099],
    ['$100', 10000],
    ['KSh 2,400', 240000],
    ['.5', 50],
    ['0.01', 1],
    ['50.', 5000],
  ])('reads %j as %i cents', (text, cents) => {
    expect(parseAmount(text)).toBe(cents)
  })

  it.each(['', ' ', '0', '0.00', 'abc', '1.234', '-5', '5-', '1.2.3', '$'])(
    'rejects %j',
    (text) => {
      expect(parseAmount(text)).toBeNull()
    },
  )

  it('rejects amounts above the API limit', () => {
    expect(parseAmount(String(MAX_CENTS / 100))).toBe(MAX_CENTS)
    expect(parseAmount(String(MAX_CENTS / 100 + 1))).toBeNull()
  })
})

describe('amountText', () => {
  it('round-trips with parseAmount', () => {
    for (const cents of [1, 50, 100, 8550, 125099, 10000]) {
      expect(parseAmount(amountText(cents))).toBe(cents)
    }
  })

  it('drops whole-number decimals and pads cents', () => {
    expect(amountText(5000)).toBe('50')
    expect(amountText(8505)).toBe('85.05')
    expect(amountText(null)).toBe('')
  })
})

describe('currencySymbol', () => {
  it('uses the narrow symbol', () => {
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('EUR')).toBe('€')
  })

  it('falls back to the code for unknown currencies', () => {
    expect(currencySymbol('nope')).toBe('nope')
  })
})

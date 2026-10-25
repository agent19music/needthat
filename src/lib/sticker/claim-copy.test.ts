import { describe, expect, it } from 'vitest'

import {
  CLAIMED_BADGE,
  CLAIMED_BY_FRIEND,
  CLAIMED_BY_YOU,
  DETAIL_MAX,
  HOW_STEPS,
  STOPPED_TITLE,
  UNSHARED_TITLE,
  clip,
  ownerCaption,
  ownerClaimLine,
  unsharedClaimLine,
} from './claim-copy'

const NOW = new Date(2026, 9, 25, 12).getTime()
const THIS_YEAR = new Date(2026, 8, 2, 12).getTime()
const LAST_YEAR = new Date(2025, 11, 30, 12).getTime()

describe('C104 owner caption', () => {
  it('short names in full', () => {
    expect(ownerCaption('Achieng')).toBe('Claimed by Achieng')
  })

  it('12 characters exactly stay whole', () => {
    expect(ownerCaption('Abcdefghijkl')).toBe('Claimed by Abcdefghijkl')
  })

  it('longer names cut to 12 plus "…", 24 characters max', () => {
    const caption = ownerCaption('Wanjiru Kamau-Otieno')
    expect(caption).toBe('Claimed by Wanjiru Kama…')
    expect(Array.from(caption).length).toBeLessThanOrEqual(24)
  })

  it('trims a trailing space before the ellipsis', () => {
    expect(ownerCaption('Mary Wambui  Njeri')).toBe('Claimed by Mary Wambui…')
  })

  it('collapses inner whitespace', () => {
    expect(ownerCaption('  Ann   Mwangi ')).toBe('Claimed by Ann Mwangi')
  })

  it('counts emoji and accents as one character each', () => {
    expect(ownerCaption('Zoë 🎁🎁🎁🎁🎁🎁🎁🎁🎁')).toBe(
      `Claimed by Zoë 🎁🎁🎁🎁🎁🎁🎁🎁…`,
    )
  })

  it.each([null, undefined, '', '   '])('C106 fallback for %j', (name) => {
    expect(ownerCaption(name)).toBe(CLAIMED_BY_FRIEND)
    expect(CLAIMED_BY_FRIEND).toBe('Claimed by a friend')
  })
})

describe('C105 owner claim line', () => {
  it('this year: day and month only', () => {
    expect(ownerClaimLine('Achieng Otieno', THIS_YEAR, NOW)).toBe(
      'Claimed by Achieng Otieno on 2 Sep',
    )
  })

  it('past years: adds the year', () => {
    expect(ownerClaimLine('Achieng', LAST_YEAR, NOW)).toBe(
      'Claimed by Achieng on 30 Dec 2025',
    )
  })

  it('never passes 40 characters, cutting long names', () => {
    for (const name of [
      'A',
      'Achieng Otieno',
      'Wanjiru Kamau-Otieno Njoroge',
      'x'.repeat(80),
    ])
      for (const at of [THIS_YEAR, LAST_YEAR]) {
        const line = ownerClaimLine(name, at, NOW)
        expect(Array.from(line).length).toBeLessThanOrEqual(DETAIL_MAX)
        expect(line.startsWith('Claimed by ')).toBe(true)
      }
    expect(ownerClaimLine('x'.repeat(80), LAST_YEAR, NOW)).toMatch(
      /^Claimed by x+… on 30 Dec 2025$/,
    )
  })

  it('C106 fallback with the date', () => {
    expect(ownerClaimLine(null, THIS_YEAR, NOW)).toBe(
      'Claimed by a friend on 2 Sep',
    )
  })
})

describe('final strings', () => {
  it('badges, titles and lines', () => {
    expect(CLAIMED_BADGE).toBe('Claimed')
    expect(CLAIMED_BY_YOU).toBe('Claimed by you')
    expect(UNSHARED_TITLE).toBe("This sheet isn't shared right now")
    expect(STOPPED_TITLE).toBe('Your link is turned off')
    expect(unsharedClaimLine(1)).toBe('Your claim is saved.')
    expect(unsharedClaimLine(3)).toBe('Your claims are saved.')
    expect(HOW_STEPS.map((step) => step.title)).toEqual([
      'Pick a sticker',
      'Claim it',
      'Buy and give it',
    ])
  })

  it('clip leaves short text alone', () => {
    expect(clip('abc', 3)).toBe('abc')
    expect(clip('abcd', 3)).toBe('abc…')
  })
})

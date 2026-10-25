import { describe, expect, it } from 'vitest'

import { publicListHead } from './site'

const ON = { showPrices: true, allowClaims: true, sharing: true }

function meta(head: ReturnType<typeof publicListHead>, key: string) {
  const entry = head.meta.find(
    (row) =>
      ('property' in row && row.property === key) ||
      ('name' in row && row.name === key),
  )
  return entry && 'content' in entry ? entry.content : undefined
}

const base = {
  username: 'sean',
  name: 'Sean',
  imageVersion: 'v1',
  items: [
    { shared: true, categoryId: 'fits' },
    { shared: true, categoryId: 'fits' },
    { shared: true, categoryId: null },
    { shared: false, categoryId: 'desk' },
  ],
  sheets: { '': ON, fits: ON, desk: { ...ON, sharing: false } },
}

describe('publicListHead (X5)', () => {
  it('whole link: X5 title, shared count only, claim sentence on', () => {
    const head = publicListHead('https://needthat.test', base)
    expect(meta(head, 'og:title')).toBe("Sean's wishlist on needthat")
    expect(meta(head, 'og:description')).toBe(
      '3 stickers across 2 sheets. Friends can claim an item to buy it as a gift.',
    )
  })

  it('drops the claim sentence when no shared sheet allows claiming', () => {
    const head = publicListHead('https://needthat.test', {
      ...base,
      sheets: {
        '': { ...ON, allowClaims: false },
        fits: { ...ON, allowClaims: false },
        desk: { ...ON, sharing: false },
      },
    })
    expect(meta(head, 'og:description')).toBe('3 stickers across 2 sheets.')
  })

  it('a stopped sheet allowing claims does not keep the sentence', () => {
    const head = publicListHead('https://needthat.test', {
      ...base,
      sheets: {
        '': { ...ON, allowClaims: false },
        fits: { ...ON, allowClaims: false },
        desk: { ...ON, sharing: false, allowClaims: true },
      },
    })
    expect(meta(head, 'og:description')).not.toMatch(/Friends can claim/)
  })

  it('one-sheet link keeps its sheet title and counts that sheet', () => {
    const head = publicListHead('https://needthat.test', base, {
      id: 'fits',
      name: 'fits',
    })
    expect(meta(head, 'og:title')).toBe('#fits · Sean on #needthat')
    expect(meta(head, 'og:description')).toMatch(/^2 stickers across 1 sheet\./)
  })

  it('nothing shared: old empty text and noindex', () => {
    const head = publicListHead('https://needthat.test', {
      ...base,
      items: [{ shared: false, categoryId: 'desk' }],
    })
    expect(meta(head, 'description')).toBe('Sean has not added a wish yet.')
    expect(meta(head, 'robots')).toBe('noindex')
  })
})

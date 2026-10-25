import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import { GotPage } from './got-page'
import { category, item } from '../../../test/fixtures'

const fits = category('Fits')
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 25, 9)

// Eight got stickers, got on days 1..8 (G8 newest), plus one still wanted.
const got = Array.from({ length: 8 }, (_, index) =>
  item({
    id: `g${index + 1}`,
    title: `G${index + 1}`,
    categoryId: fits.id,
    status: 'purchased',
    purchasedAt: NOW - (8 - index) * DAY,
  }),
)
const wanted = item({ id: 'w', title: 'Wanted', categoryId: fits.id })

function Harness({ perPage }: { perPage: number }) {
  const [page, setPage] = useState(0)
  return (
    <GotPage
      items={[...got, wanted]}
      categories={[fits]}
      now={NOW}
      showPrice
      perPage={perPage}
      page={page}
      onPage={setPage}
      previousCount={null}
      landingId={null}
      landedId={null}
      onOpen={() => {}}
    />
  )
}

function titlesOnPage() {
  const sheet = document.getElementById('nt-got-page')
  if (!sheet) throw new Error('no got page')
  return within(sheet)
    .getAllByRole('button', { name: /^G\d/ })
    .map((button) => (button.getAttribute('aria-label') ?? '').split(',')[0])
}

describe('Got page (Bau Q13: pages like a book, newest first)', () => {
  it('shows the newest six on the first page and the rest on the next', async () => {
    render(<Harness perPage={6} />)
    expect(titlesOnPage()).toEqual(['G8', 'G7', 'G6', 'G5', 'G4', 'G3'])
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Newer page' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Older page' }))
    // The old page fades out first.
    await waitFor(() => expect(titlesOnPage()).toEqual(['G2', 'G1']))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Older page' })).toBeDisabled()
  })

  it('has no pager when everything fits on one page', () => {
    render(<Harness perPage={12} />)
    expect(titlesOnPage()).toHaveLength(8)
    expect(screen.queryByRole('navigation', { name: 'Got pages' })).toBeNull()
  })

  it('never puts a wanted sticker on the Got page', () => {
    render(<Harness perPage={12} />)
    expect(screen.queryByRole('button', { name: /^Wanted/ })).toBeNull()
  })
})

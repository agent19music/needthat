import { afterEach, describe, expect, it, vi } from 'vitest'

import { readLink } from './read-link.server'

vi.mock('@sentry/tanstackstart-react', () => ({
  startSpan: (_: unknown, run: () => unknown) => run(),
}))
vi.mock('#/db/index', () => ({ getDb: vi.fn(), getImageBucket: vi.fn() }))

const page = `<meta property="og:title" content="Samba OG"><meta property="og:image" content="https://cdn.example/a.png"><meta property="og:image" content="http://cdn.example/insecure.png">`

afterEach(() => vi.unstubAllGlobals())

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('readLink', () => {
  it('reads a page and keeps only safe image links', async () => {
    const fetchMock = stubFetch(
      new Response(page, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    )
    const result = await readLink('adidas.com/samba-og')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://adidas.com/samba-og',
      expect.objectContaining({ redirect: 'follow' }),
    )
    expect(result).toEqual({
      ok: true,
      product: {
        url: 'https://adidas.com/samba-og',
        title: 'Samba OG',
        brand: '',
        images: ['https://cdn.example/a.png'],
        price: null,
      },
    })
  })

  it('refuses private hosts without fetching', async () => {
    const fetchMock = stubFetch(new Response(page))
    for (const url of [
      'http://127.0.0.1/x',
      'localhost/x',
      'https://box.internal/a',
      'not a link',
    ])
      expect((await readLink(url)).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails softly on network errors, non-HTML and untitled pages', async () => {
    stubFetch(new Error('timeout'))
    expect(await readLink('shop.example/a')).toEqual({
      ok: false,
      message: "We couldn't read that link. Add it by hand",
    })
    stubFetch(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
    )
    expect((await readLink('shop.example/a')).ok).toBe(false)
    stubFetch(
      new Response('<p>hi</p>', { headers: { 'content-type': 'text/html' } }),
    )
    expect((await readLink('shop.example/a')).ok).toBe(false)
    stubFetch(
      new Response(page, {
        status: 403,
        headers: { 'content-type': 'text/html' },
      }),
    )
    expect((await readLink('shop.example/a')).ok).toBe(false)
  })

  it('stops reading after the size cap', async () => {
    const huge = `<title>Big</title>${'x'.repeat(2_000_000)}`
    stubFetch(new Response(huge, { headers: { 'content-type': 'text/html' } }))
    const result = await readLink('shop.example/a')
    expect(result.ok && result.product.title).toBe('Big')
  })
})

import * as Sentry from '@sentry/tanstackstart-react'

import { isSafeImageUrl } from '#/lib/images/store-image.server'

import { normaliseLink, parseProductPage } from './link-reader'
import type { LinkProduct } from './link-reader'

export const LINK_TIMEOUT_MS = 8000
export const LINK_MAX_BYTES = 1_500_000

export type ReadLinkResult =
  | { ok: true; product: LinkProduct }
  | { ok: false; message: string }

const UNREADABLE = "We couldn't read that link. Add it by hand"

export async function readLink(input: string): Promise<ReadLinkResult> {
  return Sentry.startSpan({ name: 'Reading a product link' }, async () => {
    const url = normaliseLink(input)
    // Same private-host rules as image copies; pages may be http on old shops.
    if (!url || !isSafeImageUrl(url.replace(/^http:/, 'https:'))) {
      return { ok: false, message: UNREADABLE }
    }
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent':
            'Mozilla/5.0 (compatible; needthat/1.0; +https://needthat.app)',
        },
      })
    } catch {
      return { ok: false, message: UNREADABLE }
    }
    const type = response.headers.get('content-type') ?? ''
    if (!response.ok || !/html/i.test(type)) {
      return { ok: false, message: UNREADABLE }
    }
    const html = await readCapped(response, LINK_MAX_BYTES)
    const product = parseProductPage(html, response.url || url)
    product.images = product.images.filter(isSafeImageUrl)
    if (!product.title) return { ok: false, message: UNREADABLE }
    return { ok: true, product: { ...product, url } }
  })
}

async function readCapped(response: Response, max: number) {
  const reader = response.body?.getReader()
  if (!reader) return (await response.text()).slice(0, max)
  const decoder = new TextDecoder()
  let html = ''
  let size = 0
  while (size < max) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    html += decoder.decode(value, { stream: true })
  }
  void reader.cancel().catch(() => undefined)
  return html.slice(0, max)
}

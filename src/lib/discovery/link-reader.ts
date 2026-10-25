/**
 * Reads a product out of a shop page: JSON-LD `Product` first, then Open
 * Graph / product meta tags, then <title>. Pure string work so it runs in
 * tests and on the Worker without a DOM.
 */
import type { Price } from '#/lib/wishlist/types'

export type LinkProduct = {
  url: string
  title: string
  brand: string
  /** Absolute http(s) image URLs, best first, de-duplicated. */
  images: Array<string>
  /** Minor units in the shop's own currency (Q6 default: no conversion). */
  price: Price | null
}

const MAX_IMAGES = 6

export function normaliseLink(input: string): string | null {
  const raw = input.trim()
  if (!raw || /\s/.test(raw)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.hostname.includes('.')) return null
  url.hash = ''
  return url.toString()
}

/** "adidas.com/samba-og" for the link field and chips. */
export function displayLink(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${host}${path}`
  } catch {
    return url
  }
}

export function parsePrice(amount: unknown, currency: unknown): Price | null {
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : ''
  if (!/^[A-Z]{3}$/.test(code)) return null
  let value: number
  if (typeof amount === 'number') value = amount
  else if (typeof amount === 'string') {
    const cleaned = amount.replace(/[^\d.,-]/g, '')
    if (!cleaned) return null
    // "1.299,00" → 1299.00 ; "1,299.00" → 1299.00 ; "1299,5" → 1299.5
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    let normal = cleaned
    if (lastComma > lastDot) {
      const decimals = cleaned.length - lastComma - 1
      normal =
        decimals === 3 && lastDot === -1
          ? cleaned.replace(/,/g, '')
          : cleaned.replace(/\./g, '').replace(',', '.')
    } else normal = cleaned.replace(/,/g, '')
    value = Number(normal)
  } else return null
  if (!Number.isFinite(value) || value < 0) return null
  return { amount: Math.round(value * 100), currency: code }
}

export function parseProductPage(html: string, pageUrl: string): LinkProduct {
  const ld = readJsonLdProduct(html)
  const meta = readMeta(html)
  const title =
    clean(ld?.name) ||
    clean(meta.get('og:title')) ||
    clean(meta.get('twitter:title')) ||
    clean(readTitle(html))
  const brand =
    clean(ld?.brand) ||
    clean(meta.get('product:brand')) ||
    clean(meta.get('og:brand')) ||
    clean(meta.get('og:site_name'))
  const images = uniqueUrls(
    [
      ...(ld?.images ?? []),
      ...meta.getAll('og:image:secure_url'),
      ...meta.getAll('og:image'),
      ...meta.getAll('twitter:image'),
    ],
    pageUrl,
  )
  const price =
    (ld ? parsePrice(ld.price, ld.currency) : null) ??
    parsePrice(
      meta.get('product:price:amount') ?? meta.get('og:price:amount'),
      meta.get('product:price:currency') ?? meta.get('og:price:currency'),
    )
  return { url: pageUrl, title, brand, images, price }
}

type LdProduct = {
  name?: string
  brand?: string
  images: Array<string>
  price?: unknown
  currency?: unknown
}

function readJsonLdProduct(html: string): LdProduct | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const block of blocks) {
    let parsed: unknown
    try {
      parsed = JSON.parse(decodeEntities(block[1].trim()))
    } catch {
      continue
    }
    const product = findProduct(parsed, 0)
    if (product) return toLdProduct(product)
  }
  return null
}

function findProduct(
  node: unknown,
  depth: number,
): Record<string, unknown> | null {
  if (depth > 6 || !node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findProduct(entry, depth + 1)
      if (found) return found
    }
    return null
  }
  const record = node as Record<string, unknown>
  const type = record['@type']
  const types = Array.isArray(type) ? type : [type]
  if (types.some((entry) => entry === 'Product' || entry === 'ProductGroup'))
    return record
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) {
    const found = findProduct(record[key], depth + 1)
    if (found) return found
  }
  return null
}

function toLdProduct(record: Record<string, unknown>): LdProduct {
  const brandValue = record.brand
  const brand =
    typeof brandValue === 'string'
      ? brandValue
      : brandValue && typeof brandValue === 'object'
        ? String((brandValue as Record<string, unknown>).name ?? '')
        : undefined
  const images = toImageList(record.image)
  const offer = firstOffer(record.offers ?? firstVariantOffers(record))
  return {
    name: typeof record.name === 'string' ? record.name : undefined,
    brand,
    images,
    price: offer?.price ?? offer?.lowPrice,
    currency: offer?.priceCurrency,
  }
}

function firstVariantOffers(record: Record<string, unknown>) {
  const variants = record.hasVariant
  if (!Array.isArray(variants)) return undefined
  for (const variant of variants) {
    if (variant && typeof variant === 'object') {
      const offers = (variant as Record<string, unknown>).offers
      if (offers) return offers
    }
  }
  return undefined
}

function firstOffer(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstOffer(entry)
      if (found) return found
    }
    return null
  }
  const record = value as Record<string, unknown>
  if (record.price !== undefined || record.lowPrice !== undefined) {
    if (record.priceCurrency === undefined && record.priceSpecification)
      return {
        ...record,
        priceCurrency: (firstOffer(record.priceSpecification) ?? {})
          .priceCurrency,
      }
    return record
  }
  if (record.priceSpecification) return firstOffer(record.priceSpecification)
  if (record.offers) return firstOffer(record.offers)
  return null
}

function toImageList(value: unknown): Array<string> {
  if (!value) return []
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(toImageList)
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const url = record.url ?? record.contentUrl
    return typeof url === 'string' ? [url] : []
  }
  return []
}

type MetaMap = {
  get: (key: string) => string | undefined
  getAll: (key: string) => Array<string>
}

function readMeta(html: string): MetaMap {
  const values = new Map<string, Array<string>>()
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = readAttributes(tag[0])
    const key = (
      attrs.property ??
      attrs.name ??
      attrs.itemprop ??
      ''
    ).toLowerCase()
    const content = attrs.content
    if (!key || content === undefined) continue
    const list = values.get(key) ?? []
    list.push(decodeEntities(content))
    values.set(key, list)
  }
  return {
    get: (key) => values.get(key)?.[0],
    getAll: (key) => values.get(key) ?? [],
  }
}

function readAttributes(tag: string) {
  const attrs: Partial<Record<string, string>> = {}
  for (const match of tag.matchAll(
    /([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
  )) {
    const [, name, double, single, bare] = match as unknown as Array<
      string | undefined
    >
    if (name) attrs[name.toLowerCase()] = double ?? single ?? bare ?? ''
  }
  return attrs
}

function readTitle(html: string) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? decodeEntities(match[1]) : ''
}

const SIZE_PARAMS = ['width', 'height', 'w', 'h']

/**
 * Absolute, de-duplicated image URLs. Shops (Shopify especially) list the
 * same photo at many sizes (`?width=100`, `300`, …); keep one entry per
 * photo, at its largest size, so the cut never starts from a thumbnail.
 */
function uniqueUrls(values: Array<string>, base: string) {
  const best = new Map<string, { url: string; size: number }>()
  for (const value of values) {
    let parsed: URL
    try {
      parsed = new URL(value.trim(), base)
    } catch {
      continue
    }
    if (!/^https?:$/.test(parsed.protocol)) continue
    const key = new URL(parsed.toString())
    key.protocol = 'https:'
    let size = Number.POSITIVE_INFINITY
    for (const name of SIZE_PARAMS) {
      const raw = key.searchParams.get(name)
      if (raw === null) continue
      const number = Number.parseInt(raw, 10)
      if (Number.isFinite(number)) size = Math.min(size, number)
      key.searchParams.delete(name)
    }
    const id = key.toString()
    const seen = best.get(id)
    if (!seen) {
      if (best.size >= MAX_IMAGES) continue
      best.set(id, { url: parsed.toString(), size })
    } else if (
      size > seen.size ||
      (size === seen.size &&
        seen.url.startsWith('http:') &&
        parsed.protocol === 'https:')
    ) {
      best.set(id, { url: parsed.toString(), size })
    }
  }
  return Array.from(best.values(), (entry) => entry.url)
}

function clean(value: string | undefined | null) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, code: string) => {
      if (code[0] === '#') {
        const n =
          code[1] === 'x' || code[1] === 'X'
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10)
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole
      }
      return ENTITIES[code.toLowerCase()] ?? whole
    },
  )
}

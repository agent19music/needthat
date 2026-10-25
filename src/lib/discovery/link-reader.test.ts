import { describe, expect, it } from 'vitest'

import {
  displayLink,
  normaliseLink,
  parsePrice,
  parseProductPage,
} from './link-reader'

describe('normaliseLink', () => {
  it('adds https and drops the hash', () => {
    expect(normaliseLink('adidas.com/samba-og#reviews')).toBe(
      'https://adidas.com/samba-og',
    )
  })
  it('rejects names, other schemes and bare words', () => {
    expect(normaliseLink('White Nike Shox')).toBeNull()
    expect(normaliseLink('javascript://alert(1)')).toBeNull()
    expect(normaliseLink('localhost')).toBeNull()
    expect(normaliseLink('')).toBeNull()
  })
})

describe('displayLink', () => {
  it('drops www, scheme, query and trailing slash', () => {
    expect(displayLink('https://www.adidas.com/samba-og/?x=1')).toBe(
      'adidas.com/samba-og',
    )
  })
})

describe('parsePrice', () => {
  it('reads numbers and strings in minor units', () => {
    expect(parsePrice(100, 'usd')).toEqual({ amount: 10000, currency: 'USD' })
    expect(parsePrice('1,299.00', 'USD')).toEqual({
      amount: 129900,
      currency: 'USD',
    })
    expect(parsePrice('1.299,50', 'EUR')).toEqual({
      amount: 129950,
      currency: 'EUR',
    })
    expect(parsePrice('KSh 12,500', 'KES')).toEqual({
      amount: 1250000,
      currency: 'KES',
    })
  })
  it('needs a currency code and a real amount', () => {
    expect(parsePrice(100, '$')).toBeNull()
    expect(parsePrice('free', 'USD')).toBeNull()
    expect(parsePrice(-1, 'USD')).toBeNull()
    expect(parsePrice(undefined, 'USD')).toBeNull()
  })
})

describe('parseProductPage', () => {
  const url = 'https://shop.example/p/1'

  it('prefers JSON-LD Product', () => {
    const html = `<html><head>
      <meta property="og:title" content="OG title">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Samba OG","brand":{"@type":"Brand","name":"adidas"},"image":["/img/a.png",{"url":"https://cdn.example/b.png"}],"offers":{"@type":"Offer","price":"100.00","priceCurrency":"USD"}}]}</script>
      </head></html>`
    expect(parseProductPage(html, url)).toEqual({
      url,
      title: 'Samba OG',
      brand: 'adidas',
      images: ['https://shop.example/img/a.png', 'https://cdn.example/b.png'],
      price: { amount: 10000, currency: 'USD' },
    })
  })

  it('falls back to Open Graph and product meta', () => {
    const html = `<head>
      <meta content="Mac Studio &amp; more" property="og:title" />
      <meta property="og:site_name" content="Apple">
      <meta property="og:image" content="https://a.example/1.jpg">
      <meta property="og:image" content="https://a.example/1.jpg">
      <meta property="product:price:amount" content="1999">
      <meta property="product:price:currency" content="USD">
    </head>`
    const product = parseProductPage(html, url)
    expect(product.title).toBe('Mac Studio & more')
    expect(product.brand).toBe('Apple')
    expect(product.images).toEqual(['https://a.example/1.jpg'])
    expect(product.price).toEqual({ amount: 199900, currency: 'USD' })
  })

  it('reads variant offers and price specifications', () => {
    const html = `<script type='application/ld+json'>[{"@type":["Product"],"name":"Tee","hasVariant":[{"offers":{"priceSpecification":{"price":25,"priceCurrency":"GBP"}}}]}]</script>`
    expect(parseProductPage(html, url).price).toEqual({
      amount: 2500,
      currency: 'GBP',
    })
  })

  it('uses <title> when there is nothing else and survives bad JSON', () => {
    const html = `<title> Plain  page </title><script type="application/ld+json">{nope</script>`
    expect(parseProductPage(html, url)).toEqual({
      url,
      title: 'Plain page',
      brand: '',
      images: [],
      price: null,
    })
  })

  it('keeps one size per photo, the largest, preferring https', () => {
    const shot = 'https://shop.example/cdn/files/run.png?v=17'
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Runner","image":["${shot}&width=100","${shot}&width=900","https://shop.example/cdn/files/side.png?v=17&width=300"]}</script>
      <meta property="og:image" content="${shot.replace('https:', 'http:')}">
      <meta property="og:image:secure_url" content="${shot}">`
    expect(parseProductPage(html, url).images).toEqual([
      shot,
      'https://shop.example/cdn/files/side.png?v=17&width=300',
    ])
  })

  it('drops non-http images and caps the list', () => {
    const many = Array.from(
      { length: 9 },
      (_, i) =>
        `<meta property="og:image" content="https://x.example/${i}.jpg">`,
    ).join('')
    const html = `<meta property="og:image" content="data:image/png;base64,AAA">${many}`
    const images = parseProductPage(html, url).images
    expect(images).toHaveLength(6)
    expect(images[0]).toBe('https://x.example/0.jpg')
  })
})

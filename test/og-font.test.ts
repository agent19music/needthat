// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { Resvg, initWasm } from '@resvg/resvg-wasm'

import { OG_FONTS } from '#/lib/og/og-layout'

const file = (path: string) => readFileSync(`public${path}`)

/** Table tags from a TrueType table directory. */
function tables(bytes: Buffer) {
  const count = bytes.readUInt16BE(4)
  return Array.from({ length: count }, (_, index) =>
    bytes.toString('latin1', 12 + index * 16, 16 + index * 16),
  )
}

/** UTF-16BE, as name table strings are stored. */
const be = (text: string) => Buffer.from(text, 'utf16le').swap16()

function draw(family: string, fonts: Array<Uint8Array>) {
  const svg = `<svg width="600" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="100" fill="#fff"/><text x="10" y="70" font-family="${family}" font-size="56">Sean Motanya</text></svg>`
  const renderer = new Resvg(svg, {
    font: {
      fontBuffers: fonts,
      loadSystemFonts: false,
      defaultFontFamily: 'Funnel Sans',
    },
  })
  const image = renderer.render()
  const hash = createHash('md5').update(image.pixels).digest('hex')
  image.free()
  renderer.free()
  return hash
}

describe('OG fonts (r5)', () => {
  beforeAll(async () => {
    await initWasm(
      readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'),
    ).catch(() => {})
  })

  it('ships static TrueType instances with the families the SVG names', () => {
    const families = ['Tilt Warp', 'Funnel Sans', 'Funnel Display']
    OG_FONTS.forEach((path, index) => {
      const bytes = file(path)
      expect(bytes.readUInt32BE(0)).toBe(0x00010000)
      const tags = tables(bytes)
      expect(tags).toContain('glyf')
      expect(tags).not.toContain('fvar')
      expect(bytes.includes(be(families[index]))).toBe(true)
    })
  })

  it('resvg draws the name in Tilt Warp, not a fallback', () => {
    const fonts = OG_FONTS.map((path) => new Uint8Array(file(path)))
    const tilt = draw('Tilt Warp', fonts)
    expect(tilt).not.toBe(draw('Funnel Sans', fonts))
    expect(tilt).not.toBe(draw('No Such Font', fonts))
  })

  it('and at XROT 24, not the variable font default (XROT 0)', () => {
    const ours = draw('Tilt Warp', [new Uint8Array(file(OG_FONTS[0]))])
    const flat = draw('Tilt Warp', [
      new Uint8Array(file('/fonts/sticker/TiltWarp.ttf')),
    ])
    expect(ours).not.toBe(flat)
  })

  it('the OG card loads OG_FONTS', () => {
    const source = readFileSync('src/lib/og/card.server.tsx', 'utf8')
    expect(source).toContain('OG_FONTS.map')
  })
})

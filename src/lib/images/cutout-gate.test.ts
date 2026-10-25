import { describe, expect, it } from 'vitest'
import { GATE, bakeDie, cutSticker, dieRadius, gateCutout } from './cutout-gate'
import { liftStudioBackdrop, liftStudioBackdropFrame } from './studio-backdrop'

type Paint = (x: number, y: number) => [number, number, number] | null

/** RGBA frame: white backdrop, `paint` returns a product colour or null. */
function frame(width: number, height: number, paint: Paint) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const colour = paint(x, y) ?? [255, 255, 255]
      const index = (y * width + x) * 4
      data[index] = colour[0]
      data[index + 1] = colour[1]
      data[index + 2] = colour[2]
      data[index + 3] = 255
    }
  }
  return data
}

/** Alpha-only mask for gate tests: 1 = product. */
function mask(width: number, height: number, inside: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      data[(y * width + x) * 4 + 3] = inside(x, y) ? 255 : 0
  return data
}

const rect =
  (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) =>
    x >= x0 && x < x1 && y >= y0 && y < y1

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 <= r * r

const green: [number, number, number] = [30, 140, 70]

describe('gateCutout', () => {
  it('passes a single product floating in the frame', () => {
    const result = gateCutout(mask(100, 100, disc(50, 50, 30)), 100, 100)
    expect(result.ok).toBe(true)
    expect(result.touchedEdges).toBe(0)
    expect(result.mainBlob).toBe(1)
    expect(result.coverage).toBeGreaterThan(0.25)
  })

  it('allows one touched edge (a shoe cropped at the floor)', () => {
    const result = gateCutout(mask(100, 100, rect(20, 40, 80, 100)), 100, 100)
    expect(result).toMatchObject({ ok: true, touchedEdges: 1 })
  })

  it('rejects a product cropped through two or more edges', () => {
    const result = gateCutout(mask(100, 100, rect(0, 30, 100, 70)), 100, 100)
    expect(result).toMatchObject({ ok: false, reason: 'edges', touchedEdges: 2 })
  })

  it('ignores a stray pixel or two on an edge (< 2% of its length)', () => {
    const inside = (x: number, y: number) =>
      disc(100, 100, 50)(x, y) || (y === 0 && x === 3)
    const result = gateCutout(mask(200, 200, inside), 200, 200)
    expect(result.touchedEdges).toBe(0)
    expect(result.ok).toBe(true)
  })

  it('rejects fragments (largest blob under 85%)', () => {
    const inside = (x: number, y: number) =>
      disc(30, 50, 18)(x, y) || disc(72, 50, 18)(x, y)
    const result = gateCutout(mask(100, 100, inside), 100, 100)
    expect(result).toMatchObject({ ok: false, reason: 'fragmented' })
    expect(result.mainBlob).toBeCloseTo(0.5, 1)
  })

  it('tolerates small specks next to the main product', () => {
    const inside = (x: number, y: number) =>
      disc(50, 50, 30)(x, y) || rect(5, 5, 8, 8)(x, y)
    const result = gateCutout(mask(100, 100, inside), 100, 100)
    expect(result.ok).toBe(true)
    expect(result.mainBlob).toBeGreaterThan(GATE.minMainBlob)
  })

  it('rejects too little and too much coverage', () => {
    expect(gateCutout(mask(100, 100, disc(50, 50, 4)), 100, 100)).toMatchObject({
      ok: false,
      reason: 'coverage',
    })
    expect(
      gateCutout(mask(100, 100, (x, y) => !(x < 2 && y < 2)), 100, 100),
    ).toMatchObject({ ok: false, reason: 'coverage' })
    expect(gateCutout(mask(10, 10, () => false), 10, 10)).toMatchObject({
      ok: false,
      reason: 'coverage',
      mainBlob: 0,
    })
  })

  it('treats the thresholds as inclusive bounds', () => {
    // 8% exactly: a 100×100 frame with 800 opaque pixels in one block.
    const result = gateCutout(mask(100, 100, rect(30, 30, 70, 50)), 100, 100)
    expect(result.coverage).toBeCloseTo(GATE.minCoverage, 5)
    expect(result.ok).toBe(true)
  })
})

describe('dieRadius', () => {
  it('scales at 4% of the long side with a 6px floor', () => {
    expect(dieRadius(200, 100)).toBe(8)
    expect(dieRadius(800, 600)).toBe(32)
    expect(dieRadius(50, 40)).toBe(6)
  })
})

describe('bakeDie', () => {
  const size = 40
  const cut = mask(size, size, disc(20, 20, 10))
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    if (cut[pixel * 4 + 3] === 0) continue
    cut[pixel * 4] = 200
    cut[pixel * 4 + 1] = 10
    cut[pixel * 4 + 2] = 10
  }
  const die = bakeDie(cut, size, size, 6)
  const at = (x: number, y: number) => {
    const index = (y * die.width + x) * 4
    return Array.from(die.data.subarray(index, index + 4))
  }

  it('pads the canvas so the border is never clipped', () => {
    expect(die.width).toBe(size + 16)
    expect(die.height).toBe(size + 16)
    expect(at(0, 0)[3]).toBe(0)
  })

  it('keeps the product pixels on top', () => {
    expect(at(28, 28)).toEqual([200, 10, 10, 255])
  })

  it('paints solid white inside the border and nothing beyond it', () => {
    // Disc edge at x = 8 + 30 = 38 on the centre row; border runs 6px out.
    expect(at(8 + 33, 28)).toEqual([255, 255, 255, 255])
    expect(at(8 + 38, 28)[3]).toBe(0)
  })

  it('anti-aliases the outer edge', () => {
    const row = Array.from({ length: die.width }, (_, x) => at(x, 28)[3])
    expect(row.some((alpha) => alpha > 0 && alpha < 255)).toBe(true)
  })
})

describe('liftStudioBackdropFrame', () => {
  it('returns the full frame and matches the cropped lift', () => {
    const data = frame(60, 60, (x, y) => (disc(30, 30, 18)(x, y) ? green : null))
    const lifted = liftStudioBackdropFrame(data, 60, 60)
    expect(lifted).toMatchObject({ width: 60, height: 60 })
    expect(lifted?.data[3]).toBe(0)
    expect(lifted?.data[(30 * 60 + 30) * 4 + 3]).toBe(255)
    const cropped = liftStudioBackdrop(data, 60, 60)
    expect(cropped?.width).toBe(37 + 4)
  })
})

describe('cutSticker', () => {
  it('prints a die sticker from a clean studio shot', () => {
    const data = frame(120, 100, (x, y) => (disc(60, 50, 28)(x, y) ? green : null))
    const result = cutSticker(data, 120, 100)
    expect(result.kind).toBe('die')
    if (result.kind !== 'die') return
    const radius = dieRadius(57, 57)
    expect(result.width).toBe(57 + (radius + 2) * 2)
  })

  it('falls back to a photo sticker when there is no flat backdrop', () => {
    const noisy = frame(80, 80, (x, y) => [(x * 37) % 255, (y * 91) % 255, (x * y) % 255])
    expect(cutSticker(noisy, 80, 80)).toEqual({ kind: 'photo', reason: 'no-backdrop' })
  })

  it('falls back when the product runs off two edges', () => {
    const data = frame(100, 100, (x, y) =>
      rect(0, 30, 100, 80)(x, y) ? green : null,
    )
    expect(cutSticker(data, 100, 100)).toEqual({ kind: 'photo', reason: 'edges' })
  })

  it('falls back on fragmented cut-outs', () => {
    const data = frame(120, 80, (x, y) =>
      disc(30, 40, 20)(x, y) || disc(90, 40, 20)(x, y) ? green : null,
    )
    expect(cutSticker(data, 120, 80)).toEqual({ kind: 'photo', reason: 'fragmented' })
  })
})

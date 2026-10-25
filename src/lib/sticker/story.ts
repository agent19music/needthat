import { planCard } from '#/lib/sticker/layout'
import { dotFill, formatPrice, sheetMeta } from '#/lib/sticker/sheets'
import type { SheetFill } from '#/lib/sticker/sheets'

/**
 * r2 §4 Story export: 1080×1920 (360×640 @3x), 48·3 top/bottom safe areas,
 * the same share-card zones and 3 + "+N" rule. Drawn client-side on a
 * canvas from the same plan the card uses; NEW and captions never appear.
 */
export const STORY = { width: 1080, height: 1920 }

type StoryItem = {
  id: string
  imageUrl?: string | null
  price?: { amount: number; currency: string } | null
}

function cssVar(name: string, fallback: string) {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

export async function renderStory(input: {
  fill: SheetFill
  kicker: string
  title: string
  items: ReadonlyArray<StoryItem>
  total: string | null
  showPrices: boolean
  link: string
}): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = STORY.width
  canvas.height = STORY.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const images = await Promise.all(
    input.items
      .slice(0, 3)
      .map((item) =>
        item.imageUrl ? loadImage(item.imageUrl) : Promise.resolve(null),
      ),
  )
  // B3·05 is drawn at 360×640 and exported @3x. Sticker zone 270–555.
  const k = STORY.width / 360
  const zoneTop = 270
  const plan = planCard(
    input.items.map((item, index) => {
      const image = images[index]
      return {
        id: item.id,
        aspect:
          image && image.naturalHeight
            ? image.naturalWidth / image.naturalHeight
            : null,
      }
    }),
    { width: 360, height: 472 },
  )
  const shift = zoneTop - plan.zone.top
  const s = plan.scale
  const ui = cssVar('--nt-font-ui', 'sans-serif')
  const display = cssVar('--nt-font-display', ui)
  const num = cssVar('--nt-font-num', ui)
  const ink = '#1d1d1f'
  const bg =
    input.fill === 'white'
      ? '#ffffff'
      : cssVar(`--nt-sheet-${input.fill}-bg`, '#ffffff')
  const fg =
    input.fill === 'white' ? ink : cssVar(`--nt-sheet-${input.fill}-fg`, ink)
  ctx.scale(k, k)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 360, 640)

  // Wordmark sticker (yellow pill, white die line), rotated -3°.
  ctx.save()
  ctx.translate(84, 82)
  ctx.rotate((-3 * Math.PI) / 180)
  ctx.font = `${17}px ${display}`
  const markW = ctx.measureText('#needthat').width + 32
  ctx.beginPath()
  ctx.roundRect(-markW / 2 - 4, -21, markW + 8, 42, 21)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,.16)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.roundRect(-markW / 2, -17, markW, 34, 17)
  ctx.fillStyle = cssVar('--nt-yellow', '#ffc72c')
  ctx.fill()
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('#needthat', 0, 1)
  ctx.restore()

  // Header: kicker, title, count line.
  ctx.fillStyle = fg
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 10px ${ui}`
  ctx.letterSpacing = '1.6px'
  ctx.fillText(input.kicker.toUpperCase(), 28, 141)
  ctx.letterSpacing = '0px'
  ctx.font = `52px ${display}`
  ctx.fillText(input.title, 26, 210)
  ctx.font = `600 15px ${ui}`
  ctx.fillText(
    sheetMeta(input.items.length, input.showPrices ? input.total : null),
    28,
    252,
  )

  ctx.save()
  ctx.translate(0, shift)
  // Stickers and dots.
  plan.places.forEach((place, index) => {
    const image = images[index]
    const item = input.items[index]
    ctx.save()
    ctx.translate(place.x + place.w / 2, place.y + place.h / 2)
    ctx.rotate((place.rotate * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,.18)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    if (image) {
      ctx.drawImage(image, -place.w / 2, -place.h / 2, place.w, place.h)
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-place.w / 2, -place.h / 2, place.w, place.h)
    }
    ctx.restore()
    const price = input.showPrices ? formatPrice(item.price ?? null) : null
    if (price) {
      const r = place.dot.size / 2
      const cx = place.dot.x + r
      const cy = place.dot.y + r
      const tone = dotFill(item.id, input.fill)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, r - 2.5, 0, Math.PI * 2)
      ctx.fillStyle =
        tone === 'white' ? '#ffffff' : cssVar(`--nt-dot-${tone}`, ink)
      ctx.fill()
      if (tone === 'white') {
        ctx.lineWidth = 3
        ctx.strokeStyle = ink
        ctx.stroke()
      }
      ctx.fillStyle =
        tone === 'white' ? ink : cssVar(`--nt-dot-${tone}-fg`, '#ffffff')
      ctx.font = `700 ${Math.max(9, r * 0.54)}px ${num}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(price, cx, cy)
      ctx.textAlign = 'start'
    }
  })
  if (plan.more) {
    const r = plan.more.size / 2
    const cx = plan.more.x + r
    const cy = plan.more.y + r
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = ink
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${18 * s}px ${num}`
    ctx.fillText(`+${plan.hidden}`, cx, cy - 6 * s)
    ctx.font = `600 ${10 * s}px ${ui}`
    ctx.fillText('more', cx, cy + 10 * s)
    ctx.textAlign = 'start'
  }
  ctx.restore()

  // Link row above the bottom safe area.
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.font = `600 14px ${ui}`
  ctx.fillText(input.link, 28, 571)
  ctx.lineWidth = 1.6
  ctx.strokeStyle = fg
  ctx.beginPath()
  ctx.moveTo(318, 577)
  ctx.lineTo(328, 567)
  ctx.moveTo(321, 567)
  ctx.lineTo(328, 567)
  ctx.lineTo(328, 574)
  ctx.stroke()

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      // A cross-origin image without CORS taints the canvas.
      resolve(null)
    }
  })
}

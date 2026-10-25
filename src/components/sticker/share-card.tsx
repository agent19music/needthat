import type { CSSProperties } from 'react'

import { PriceDot, StickerArt } from '#/components/sticker/sticker'
import { planCard } from '#/lib/sticker/layout'
import { useAspects } from '#/lib/sticker/aspects'
import { dotFill, formatPrice, sheetMeta } from '#/lib/sticker/sheets'
import type { SheetFill } from '#/lib/sticker/sheets'
import type { GuestItem } from '#/lib/guest-wishlist'

/**
 * r2 §4 share card (B3·01 / B3·07 / B3·08). 300×380 base, everything in
 * card px scaled by the container: header 0–112 (kicker, name, count line),
 * footer 44 (wordmark + link chip), max 3 stickers in fixed slots plus "+N".
 * No NEW, no captions. "Show prices" off hides dots and the total.
 */
export function ShareCard({
  fill,
  kicker,
  title,
  stickers,
  total,
  showPrices,
  link,
}: {
  fill: SheetFill
  kicker: string
  title: string
  stickers: ReadonlyArray<GuestItem>
  total: string | null
  showPrices: boolean
  /** Link chip text: host + first path segment (r2 #19 / C90). */
  link: string
}) {
  const aspectOf = useAspects(stickers)
  const plan = planCard(
    stickers.map((item) => ({ id: item.id, aspect: aspectOf(item) })),
  )
  const u = (value: number) =>
    `calc(${(value / plan.width).toFixed(5)} * 100cqw)`
  const byId = new Map(stickers.map((item) => [item.id, item]))
  return (
    <div className="nt-card" data-fill={fill}>
      <div className="nt-card-head">
        <span className="nt-kicker">{kicker}</span>
        <h3>{title}</h3>
        <p>{sheetMeta(stickers.length, showPrices ? total : null)}</p>
      </div>
      {plan.places.map((place) => {
        const item = byId.get(place.id)
        if (!item) return null
        const price = showPrices ? formatPrice(item.price) : null
        const box: CSSProperties = {
          left: u(place.x),
          top: u(place.y),
          width: u(place.w),
          height: u(place.h),
        }
        return (
          <span key={place.id} className="nt-card-st" style={box}>
            <StickerArt item={item} rotate={place.rotate} />
            {price ? (
              <PriceDot
                label={price}
                fill={dotFill(item.id, fill)}
                // The 11px price must fit: B3·01 draws the dots at ~35px on the 270 card.
                size={`max(${u(place.dot.size)}, 34px)`}
                rotate={place.lane === 'R' ? 8 : -8}
                style={{
                  position: 'absolute',
                  left: `calc(${u(place.dot.x)} - ${u(place.x)})`,
                  top: `calc(${u(place.dot.y)} - ${u(place.y)})`,
                }}
              />
            ) : null}
          </span>
        )
      })}
      {plan.more ? (
        <span
          className="nt-more nt-card-more"
          style={{
            left: u(plan.more.x),
            top: u(plan.more.y),
            width: u(plan.more.size),
            height: u(plan.more.size),
          }}
        >
          <b style={{ fontSize: u(18) }}>+{plan.hidden}</b>
          <span style={{ fontSize: u(10) }}>more</span>
        </span>
      ) : null}
      <div className="nt-card-foot">
        <span className="nt-card-mark">#needthat</span>
        <span className="nt-card-link">{link}</span>
      </div>
    </div>
  )
}

export { linkChip } from '#/lib/sticker/link-chip'

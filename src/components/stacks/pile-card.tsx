import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { GotStamp } from '#/components/stacks/got-stamp'
import { instant, t } from '#/components/stacks/tokens'
import { formatPrice, gotTime, pileCardPose } from '#/lib/stacks/stacks'
import type { GuestItem } from '#/lib/guest-wishlist'

/** Card face shared by piles, the strip and the arrange row. */
export function CardFace({
  item,
  showStamp = true,
  freshStamp = false,
}: {
  item: GuestItem
  showStamp?: boolean
  freshStamp?: boolean
}) {
  const price = formatPrice(item.price)
  const got = item.status === 'purchased'
  return (
    <>
      <span className="stk-pic">
        <ItemImage item={item} />
      </span>
      <span className="stk-meta">
        <b>{item.title}</b>
        <span className="stk-row">
          <span>{item.brand}</span>
          {price ? <span className="stk-mono">{price}</span> : null}
        </span>
      </span>
      {got && showStamp ? (
        <span className="stk-stamp-slot">
          <GotStamp date={gotTime(item)} fresh={freshStamp} />
        </span>
      ) : null}
    </>
  )
}

/**
 * One of the top three cards of a pile. `depth` 0 is the top card.
 * Only the top card is interactive; the others are decoration.
 */
export function PileCard({
  item,
  depth,
  fanned,
}: {
  item: GuestItem
  depth: number
  fanned: boolean
}) {
  const reduced = useReducedMotion() ?? false
  const [rotate, x, y] = pileCardPose(depth, fanned, reduced)
  return (
    <motion.span
      className="stk-card"
      data-depth={depth}
      data-got={item.status === 'purchased' || undefined}
      aria-hidden={depth > 0 || undefined}
      initial={false}
      animate={{ rotate, x, y }}
      style={{ zIndex: 3 - depth }}
      transition={
        reduced
          ? instant
          : {
              duration: t.d.fast,
              ease: t.ease.enter,
              delay: depth * t.stagger,
            }
      }
    >
      <CardFace item={item} showStamp={depth === 0} />
    </motion.span>
  )
}

/** Item picture: the stored blob (guest uploads) or the remote URL. */
export function ItemImage({ item }: { item: GuestItem }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!item.image || typeof URL.createObjectURL !== 'function') {
      setBlobUrl(null)
      return
    }
    const url = URL.createObjectURL(item.image)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [item.image])
  const src = blobUrl ?? item.imageUrl
  if (!src) return <span className="stk-pic-empty" aria-hidden="true" />
  return <img src={src} alt="" draggable={false} referrerPolicy="no-referrer" />
}

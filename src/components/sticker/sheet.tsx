import { useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'

import {
  ClaimedTag,
  Ghost,
  GotLabel,
  PriceDot,
  Star,
  StickerArt,
} from '#/components/sticker/sticker'
import {
  MOTION,
  burstAnimation,
  shouldCommitPeel,
  slapIn,
  slapTransition,
} from '#/components/sticker/motion'
import {
  dotFill,
  dotRotation,
  formatPrice,
  gotLabel,
  gotSubCaption,
  gotTime,
  isNew,
  layoutSheet,
  moreLabel,
  seeded,
  stickerLabel,
} from '#/lib/sticker/sheets'
import type { LayoutVariant, SheetFill, Slot } from '#/lib/sticker/sheets'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

/** board: owner's sheets (got items are ghosts) · got: Got sheet/page · public: claim view. */
export type SheetMode = 'board' | 'got' | 'public'

export type ClaimState = { claimed: boolean; mine: boolean }

export type SheetProps = {
  fill: SheetFill
  kicker?: string | null
  title: string
  meta?: string | null
  variant: LayoutVariant
  stickers: ReadonlyArray<GuestItem>
  mode: SheetMode
  now: number
  showPrice: boolean
  /** Needed for Got sub-captions. */
  categories?: ReadonlyArray<GuestCategory>
  allItems?: ReadonlyArray<GuestItem>
  /** Newest got sticker: full colour and the progress sub-caption. */
  newestGotId?: string | null
  peelable?: boolean
  onOpen?: (item: GuestItem, opener: HTMLElement) => void
  onPeel?: (item: GuestItem, from: DOMRect) => void
  /** Sticker just printed: slaps on with the NEW star. */
  printedId?: string | null
  /** Sticker in flight to this sheet: its slot shows as a dashed landing. */
  landingId?: string | null
  /** Sticker that just landed: slap, GOT IT! burst, label. */
  landedId?: string | null
  claimOf?: (item: GuestItem) => ClaimState
  onMore?: () => void
  /** Overlays inside the sheet (hint, note, count pill, blank slots). */
  children?: ReactNode
  highlight?: boolean
  active?: boolean
  style?: CSSProperties
  className?: string
  id?: string
  sheetRef?: (element: HTMLElement | null) => void
}

const AUTO_HEIGHT: ReadonlyArray<LayoutVariant> = ['column', 'page', 'wall']

export function Sheet(props: SheetProps) {
  const layout = layoutSheet(props.stickers, props.variant)
  const byId = new Map(props.stickers.map((item) => [item.id, item]))
  const auto = AUTO_HEIGHT.includes(props.variant) && layout.height > 0
  const more = moreLabel(layout.hidden)
  return (
    <section
      ref={props.sheetRef}
      id={props.id}
      className={['nt-sheet', props.className].filter(Boolean).join(' ')}
      data-fill={props.fill}
      data-variant={props.variant}
      data-highlight={props.highlight ? 'true' : undefined}
      data-active={props.active ? 'true' : undefined}
      aria-label={`${props.title}${props.meta ? `, ${props.meta}` : ''}`}
      style={{
        ...(auto ? { aspectRatio: `1 / ${layout.height}` } : null),
        ...props.style,
      }}
    >
      <header className="nt-sheet-head">
        {props.kicker ? (
          <span className="nt-kicker">{props.kicker}</span>
        ) : null}
        <h3>{props.title}</h3>
        {props.meta ? <p>{props.meta}</p> : null}
      </header>
      {layout.slots.map((slot) => {
        const item = byId.get(slot.id)
        if (!item) return null
        return (
          <StickerSlot
            key={props.landedId === item.id ? `${item.id}:landed` : item.id}
            item={item}
            slot={slot}
            dot={layout.dot}
            sheet={props}
          />
        )
      })}
      {more && props.onMore ? (
        <button
          type="button"
          className="nt-more"
          onClick={props.onMore}
          aria-label={`${layout.hidden} more on ${props.title}`}
          style={moreStyle(props.variant, layout.dot)}
        >
          <span style={{ textAlign: 'center', lineHeight: 1 }}>
            <span style={{ display: 'block', fontSize: '1.3em' }}>{more}</span>
            <span style={{ fontSize: '.8em', fontWeight: 600 }}>more</span>
          </span>
        </button>
      ) : null}
      {props.children}
    </section>
  )
}

function moreStyle(variant: LayoutVariant, dot: number): CSSProperties {
  // 1440 frames: the white "+N more" dot sits at the right edge, mid-height.
  const place =
    variant === 'got'
      ? { left: '86.8cqw', top: '35.4cqw', rotate: -4 }
      : variant === 'half'
        ? { left: '80cqw', top: '96cqw', rotate: 6 }
        : { left: '91.3cqw', top: '14.8cqw', rotate: 6 }
  const size = Math.max(dot, 0.064)
  return {
    '--d': size,
    left: place.left,
    top: place.top,
    transform: `rotate(${place.rotate}deg)`,
  } as CSSProperties
}

/* ------------------------------------------------------------------ */

type Drag = {
  id: number
  touch: boolean
  x: number
  y: number
  lifted: boolean
  timer: number | null
  samples: Array<{ y: number; t: number }>
}

const HOLD_MS = 220

function StickerSlot({
  item,
  slot,
  dot,
  sheet,
}: {
  item: GuestItem
  slot: Slot
  dot: number
  sheet: SheetProps
}) {
  const reduced = useReducedMotion() ?? false
  const [ratio, setRatio] = useState<number | null>(null)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const button = useRef<HTMLButtonElement>(null)
  const art = useRef<HTMLSpanElement>(null)

  const got = item.status === 'purchased'
  const ghost = (sheet.mode === 'board' || sheet.mode === 'public') && got
  const peelable = Boolean(sheet.peelable && sheet.onPeel && !got)
  const claim = sheet.claimOf?.(item)
  const price = sheet.showPrice ? formatPrice(item.price) : null
  const fresh = sheet.mode !== 'got' && isNew(item, sheet.now)
  const printed = sheet.printedId === item.id
  const landing = sheet.landingId === item.id
  const landed = sheet.landedId === item.id
  const old =
    sheet.mode === 'got' &&
    sheet.newestGotId != null &&
    sheet.newestGotId !== item.id
  const dotSide = fresh || seeded(item.id, 'dot-side') < 0.5 ? 'left' : 'right'

  // Box height follows the image (wide shoes, tall chairs), capped at 4:3.
  const height =
    ratio && ratio > 0 ? Math.max(0.36, Math.min(0.75, 1 / ratio)) : 0.75

  // While lifted, stop the page from scrolling under the finger.
  useEffect(() => {
    const element = button.current
    if (!element) return
    function block(event: TouchEvent) {
      if (drag.current?.lifted) event.preventDefault()
    }
    element.addEventListener('touchmove', block, { passive: false })
    return () => element.removeEventListener('touchmove', block)
  }, [])

  useEffect(
    () => () => {
      if (drag.current?.timer) window.clearTimeout(drag.current.timer)
    },
    [],
  )

  function lift() {
    const current = drag.current
    if (!current) return
    current.lifted = true
    current.timer = null
    setOffset({ x: 0, y: 0 })
    try {
      button.current?.setPointerCapture(current.id)
    } catch {
      // The pointer may already be gone.
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!peelable || event.button !== 0) return
    const touch = event.pointerType !== 'mouse'
    drag.current = {
      id: event.pointerId,
      touch,
      x: event.clientX,
      y: event.clientY,
      lifted: false,
      timer: touch ? window.setTimeout(lift, HOLD_MS) : null,
      samples: [{ y: event.clientY, t: event.timeStamp }],
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || event.pointerId !== current.id) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.lifted) {
      const distance = Math.hypot(dx, dy)
      if (current.touch) {
        // Moved before the hold finished: it's a scroll, not a peel.
        if (distance > 8) {
          if (current.timer) window.clearTimeout(current.timer)
          drag.current = null
        }
        return
      }
      if (distance < 5) return
      lift()
    }
    current.samples.push({ y: event.clientY, t: event.timeStamp })
    if (current.samples.length > 6) current.samples.shift()
    setOffset({ x: dx, y: dy })
  }

  function finish(
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled: boolean,
  ) {
    const current = drag.current
    if (!current || event.pointerId !== current.id) return
    if (current.timer) window.clearTimeout(current.timer)
    drag.current = null
    if (!current.lifted) return
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
    const dy = event.clientY - current.y
    const first = current.samples[0]
    const last = current.samples.at(-1) ?? first
    const elapsed = Math.max(1, last.t - first.t) / 1000
    const velocity = (last.y - first.y) / elapsed
    if (!cancelled && shouldCommitPeel(dy, velocity)) {
      const rect = art.current?.getBoundingClientRect()
      setOffset(null)
      if (rect) sheet.onPeel?.(item, rect)
      return
    }
    setOffset(null)
  }

  function peelNow() {
    const rect = art.current?.getBoundingClientRect()
    if (rect) sheet.onPeel?.(item, rect)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!peelable) return
    if (event.key === 'g' || event.key === 'G') {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      peelNow()
    }
  }

  const style = {
    '--x': slot.x,
    '--y': slot.y,
    '--s': slot.size,
    '--h': height,
    '--z': slot.z,
  } as CSSProperties

  const d = `calc(${dot} * 100cqw)`
  const dotStyle: CSSProperties =
    dotSide === 'right'
      ? { left: `calc(100% - ${dot} * 70cqw)`, top: `calc(${dot} * -25cqw)` }
      : { left: `calc(${dot} * -30cqw)`, top: `calc(${dot} * -22cqw)` }
  const starSize = `max(40px, calc(${dot} * 118cqw))`
  const burstSize = `max(64px, calc(${dot} * 210cqw))`
  const labelTilt = (seeded(item.id, 'label') * 2 - 1) * 4

  const caption = captionFor(item, sheet, ghost, old)

  if (ghost) {
    return (
      <div className="nt-slot" data-ghost style={style}>
        <Ghost item={item} rotate={slot.rotate} />
        {sheet.mode === 'public' ? (
          // Claim view (as-claim-390): label low on the ghost, no caption.
          <GotLabel
            text={gotLabel(gotTime(item))}
            style={{
              left: '-4%',
              top: '66%',
              transform: `rotate(${-3 + labelTilt / 2}deg)`,
            }}
          />
        ) : (
          <>
            <GotLabel
              text={gotLabel(gotTime(item))}
              style={{
                left: '28%',
                top: -16,
                transform: `rotate(${-4 + labelTilt / 2}deg)`,
              }}
            />
            <Caption title={item.title} sub="peeled · in Got" />
          </>
        )}
      </div>
    )
  }

  const lifted = offset !== null
  const liftTransition = lifted
    ? {
        x: { duration: 0 },
        y: { duration: 0 },
        scale: { duration: reduced ? 0 : MOTION.lift.duration },
        rotate: { duration: reduced ? 0 : MOTION.lift.duration },
      }
    : { type: 'spring' as const, stiffness: 520, damping: 34 }

  const enter = printed ? slapIn(reduced) : landed ? slapIn(reduced) : null

  return (
    <motion.div
      className={['nt-slot', landing ? 'nt-landing' : null]
        .filter(Boolean)
        .join(' ')}
      data-lifted={lifted ? 'true' : undefined}
      data-got-target={sheet.mode === 'got' ? item.id : undefined}
      style={style}
      initial={enter?.initial}
      animate={enter?.animate}
      transition={slapTransition(reduced)}
    >
      <button
        ref={button}
        type="button"
        className="nt-sticker"
        aria-label={stickerLabel(item, {
          now: sheet.now,
          showPrice: sheet.showPrice,
        })}
        aria-describedby={peelable ? 'nt-peel-help' : undefined}
        style={{
          visibility: landing ? 'hidden' : undefined,
          touchAction: peelable ? 'pan-y' : undefined,
          cursor: peelable ? 'grab' : undefined,
        }}
        onClick={(event) => {
          if (suppressClick.current) {
            event.preventDefault()
            return
          }
          sheet.onOpen?.(item, event.currentTarget)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          // A long press lifts the sticker; don't open the OS menu on top.
          if (peelable && drag.current?.touch) event.preventDefault()
        }}
      >
        <motion.span
          ref={art}
          style={{ position: 'absolute', inset: 0, display: 'block' }}
          animate={
            lifted
              ? {
                  x: offset.x,
                  y: offset.y + (reduced ? 0 : MOTION.lift.y),
                  scale: reduced ? 1 : MOTION.lift.scale,
                  rotate: reduced ? 0 : MOTION.lift.rotate,
                }
              : { x: 0, y: 0, scale: 1, rotate: 0 }
          }
          transition={liftTransition}
        >
          <StickerArt
            item={item}
            rotate={slot.rotate}
            className={old ? 'nt-old' : undefined}
            onAspect={setRatio}
          />
          {price ? (
            <PriceDot
              label={price}
              fill={dotFill(
                item.id,
                sheet.mode === 'got' ? 'yellow' : sheet.fill,
              )}
              size={d}
              rotate={dotRotation(item.id)}
              style={dotStyle}
            />
          ) : null}
        </motion.span>
      </button>
      {fresh ? (
        <PrintStar
          animate={printed}
          reduced={reduced}
          size={starSize}
          rotate={12}
          style={{
            right: `calc(${dot} * -30cqw)`,
            top: `calc(${dot} * -40cqw)`,
          }}
        />
      ) : null}
      {sheet.mode === 'got' || (sheet.mode === 'public' && got) ? (
        <motion.span
          style={{
            position: 'absolute',
            left: '30%',
            top: 'calc(100% + 14px)',
            zIndex: 6,
          }}
          initial={landed ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{
            delay: landed ? (reduced ? 0 : MOTION.label.delay + 0.14) : 0,
            duration: MOTION.label.duration,
          }}
        >
          <GotLabel
            text={gotLabel(gotTime(item))}
            style={{
              position: 'relative',
              transform: `rotate(${labelTilt}deg)`,
            }}
          />
        </motion.span>
      ) : null}
      {landed ? (
        <motion.span
          className="nt-burst"
          style={{
            position: 'absolute',
            right: `calc(${dot} * -60cqw)`,
            top: `calc(${dot} * -90cqw)`,
            zIndex: 7,
          }}
          {...burstAnimation(reduced)}
        >
          <Star label="GOT IT!" size={burstSize} fill="red" fontSize={15} />
        </motion.span>
      ) : null}
      {claim?.claimed ? (
        <motion.span
          style={{ position: 'absolute', left: '14%', top: '82%', zIndex: 7 }}
          initial={reduced ? { opacity: 0 } : { scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={slapTransition(reduced)}
        >
          <ClaimedTag
            style={{
              position: 'relative',
              transform: `rotate(${MOTION.claimed.rotate}deg)`,
            }}
          />
        </motion.span>
      ) : null}
      {caption ? (
        <Caption
          title={caption.title}
          sub={caption.sub}
          below={sheet.mode === 'got' || (sheet.mode === 'public' && got)}
        />
      ) : null}
    </motion.div>
  )
}

function captionFor(
  item: GuestItem,
  sheet: SheetProps,
  ghost: boolean,
  old: boolean,
): { title: string; sub: string | null } | null {
  if (ghost) return { title: item.title, sub: 'peeled · in Got' }
  if (sheet.mode === 'got') {
    const sub =
      sheet.categories && sheet.allItems
        ? gotSubCaption(item, sheet.allItems, sheet.categories, {
            newest: !old && sheet.newestGotId === item.id,
            showPrice: sheet.showPrice,
          })
        : sheet.showPrice
          ? formatPrice(item.price)
          : null
    return { title: item.title, sub }
  }
  if (sheet.mode === 'public') return null
  return { title: item.title, sub: item.brand || null }
}

function Caption({
  title,
  sub,
  below = false,
}: {
  title: string
  sub: string | null
  below?: boolean
}) {
  return (
    <span
      className="nt-cap"
      aria-hidden="true"
      style={below ? { top: 'calc(100% + 52px)' } : undefined}
    >
      {title}
      {sub ? <span>{sub}</span> : null}
    </span>
  )
}

function PrintStar({
  animate,
  reduced,
  size,
  rotate,
  style,
}: {
  animate: boolean
  reduced: boolean
  size: string
  rotate: number
  style: CSSProperties
}) {
  return (
    <motion.span
      style={{ position: 'absolute', zIndex: 6, ...style }}
      initial={
        animate ? (reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }) : false
      }
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: animate ? MOTION.print.duration : 0,
        duration: reduced ? MOTION.reduced.duration : MOTION.print.star,
      }}
    >
      <Star
        label="NEW"
        size={size}
        rotate={rotate}
        style={{ position: 'relative' }}
      />
    </motion.span>
  )
}

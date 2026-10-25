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
  formatPrice,
  gotDate,
  gotTime,
  moreLabel,
  stickerLabel,
} from '#/lib/sticker/sheets'
import type { SheetFill } from '#/lib/sticker/sheets'
import { dotDiameter, planSheet, planGotWall } from '#/lib/sticker/layout'
import type { LayoutKind, Placement, Plan } from '#/lib/sticker/layout'
import { reportAspect, useAspects } from '#/lib/sticker/aspects'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

/** board: owner's sheets (got items are ghosts) · got: Got sheet/page · public: claim view. */
export type SheetMode = 'board' | 'got' | 'public'

export type ClaimState = { claimed: boolean; mine: boolean }

export type SheetProps = {
  fill: SheetFill
  kicker?: string | null
  title: string
  meta?: string | null
  /** Inline pill under the meta (Got: "1 this year", r2 #16/#23). */
  metaPill?: string | null
  variant: LayoutKind
  stickers: ReadonlyArray<GuestItem>
  mode: SheetMode
  now: number
  showPrice: boolean
  /** Owner view: ids that wear the NEW star (newBadgeIds). */
  newIds?: ReadonlySet<string>
  /** 390 column: reserve room for the peel hint / FAB (r2 #11). */
  hint?: boolean
  fab?: boolean
  /** Needed for Got sub-captions. */
  categories?: ReadonlyArray<GuestCategory>
  allItems?: ReadonlyArray<GuestItem>
  /** Newest got sticker: full colour. */
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

/** r3: px the price dot box keeps clear of the sheet edge (its 8° turn adds ~3). */
const DOT_INSET = 8

/**
 * r3: the dot's `left` inside its sticker, clamped so the dot box stays
 * DOT_INSET px inside both sheet edges. `slotX` is the sticker's left and
 * `size` the dot's rendered diameter; 100cqw is the sheet width.
 */
export function dotLeft(left: string, slotX: string, size: string) {
  return `clamp(calc(${DOT_INSET}px - ${slotX}), ${left}, calc(100cqw - ${slotX} - ${size} - ${DOT_INSET}px))`
}

/** Design px → a length that scales with the sheet (cqw of .nt-sheet). */
export function scaled(plan: { width: number }, value: number) {
  return `calc(${(value / plan.width).toFixed(5)} * 100cqw)`
}

export function Sheet(props: SheetProps) {
  const aspectOf = useAspects(props.stickers)
  const inputs = props.stickers.map((item) => ({
    id: item.id,
    aspect: aspectOf(item),
    ghost: item.status === 'purchased',
  }))
  const plan =
    props.variant === 'wall' && props.mode === 'got'
      ? planGotWall(inputs)
      : planSheet(props.variant, inputs, { hint: props.hint, fab: props.fab })
  const byId = new Map(props.stickers.map((item) => [item.id, item]))
  const more = moreLabel(plan.hidden)
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
      style={{ aspectRatio: `${plan.width} / ${plan.height}`, ...props.style }}
    >
      <header className="nt-sheet-head">
        {props.kicker ? (
          <span className="nt-kicker">{props.kicker}</span>
        ) : null}
        <h3>{props.title}</h3>
        {props.meta ? <p>{props.meta}</p> : null}
        {props.metaPill ? (
          <span className="nt-year">{props.metaPill}</span>
        ) : null}
      </header>
      {plan.places.map((place, index) => {
        const item = byId.get(place.id)
        if (!item) return null
        return (
          <StickerSlot
            key={props.landedId === item.id ? `${item.id}:landed` : item.id}
            item={item}
            place={place}
            plan={plan}
            z={index + 1}
            sheet={props}
          />
        )
      })}
      {more && plan.more ? (
        <MoreSticker
          plan={plan}
          label={more}
          title={props.title}
          hidden={plan.hidden}
          onMore={props.onMore}
        />
      ) : null}
      {props.children}
    </section>
  )
}

function MoreSticker({
  plan,
  label,
  title,
  hidden,
  onMore,
}: {
  plan: Plan
  label: string
  title: string
  hidden: number
  onMore?: () => void
}) {
  const spot = plan.more
  if (!spot) return null
  const u = (value: number) => scaled(plan, value)
  const style: CSSProperties = {
    left: u(spot.x),
    top: u(spot.y),
    width: u(spot.size),
    height: u(spot.size),
  }
  const body = (
    <>
      <b style={{ fontSize: u(18) }}>{label}</b>
      <span style={{ fontSize: u(10) }}>more</span>
    </>
  )
  if (!onMore)
    return (
      <span
        className="nt-more"
        style={style}
        aria-label={`${hidden} more on ${title}`}
      >
        {body}
      </span>
    )
  return (
    <button
      type="button"
      className="nt-more"
      onClick={onMore}
      aria-label={`${hidden} more on ${title}`}
      style={style}
    >
      {body}
    </button>
  )
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
  place,
  plan,
  z,
  sheet,
}: {
  item: GuestItem
  place: Placement
  plan: Plan
  z: number
  sheet: SheetProps
}) {
  const reduced = useReducedMotion() ?? false
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
  // r2 #7/#35: owner only, from newBadgeIds (72h, unopened, max 2).
  const fresh = sheet.mode === 'board' && Boolean(sheet.newIds?.has(item.id))
  const printed = sheet.printedId === item.id
  const landing = sheet.landingId === item.id
  const landed = sheet.landedId === item.id
  const old =
    sheet.mode === 'got' &&
    sheet.newestGotId != null &&
    sheet.newestGotId !== item.id
  const u = (value: number) => scaled(plan, value)
  /** Point relative to the die bbox. */
  const at = (point: { x: number; y: number }) => ({
    left: u(point.x - place.x),
    top: u(point.y - place.y),
  })

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

  const style: CSSProperties = {
    left: u(place.x),
    top: u(place.y),
    width: u(place.w),
    height: u(place.h),
    zIndex: z,
  }
  // r3: never below ⌀44 on screen, larger for long prices; grow around the
  // planned centre so the dot keeps its spot on the corner.
  const dot = dotDiameter(price)
  const dotGrow = (dot - place.dot.size) / 2
  const dotSize = `max(${u(dot)}, ${dot}px)`
  const dotAt = at({ x: place.dot.x - dotGrow, y: place.dot.y - dotGrow })
  // r3: keep the dot inside the sheet edge (900/1024 right lane).
  const dotStyle: CSSProperties = {
    ...dotAt,
    left: dotLeft(String(dotAt.left), u(place.x), dotSize),
  }
  const caption = captionFor(item, sheet, ghost)
  const captionStyle: CSSProperties = {
    ...at(place.caption),
    width: u(place.caption.w),
  }
  // r2 B3·04: claim pill on the sticker's bottom-inner corner.
  const claimStyle: CSSProperties =
    place.lane === 'R'
      ? { left: u(-8), top: u(place.h - 20) }
      : { right: u(-8), top: u(place.h - 20) }

  if (ghost) {
    return (
      <div className="nt-slot" data-ghost style={style}>
        <Ghost item={item} rotate={place.rotate} />
        <GotLabel text="GOT" style={at(place.pill)} />
        {caption ? (
          <Caption
            title={caption.title}
            sub={caption.sub}
            style={captionStyle}
          />
        ) : null}
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
          fresh,
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
            rotate={place.rotate}
            className={old ? 'nt-old' : undefined}
            onAspect={(ratio) => reportAspect(item, ratio)}
          />
          {price ? (
            <PriceDot
              label={price}
              fill={dotFill(
                item.id,
                sheet.mode === 'got' ? 'yellow' : sheet.fill,
              )}
              size={dotSize}
              rotate={place.lane === 'R' ? 8 : -8}
              style={dotStyle}
            />
          ) : null}
        </motion.span>
      </button>
      {fresh ? (
        <PrintStar
          animate={printed}
          reduced={reduced}
          size={u(place.star.size)}
          rotate={10}
          style={at(place.star)}
        />
      ) : null}
      {sheet.mode === 'got' ? (
        <motion.span
          style={{ position: 'absolute', zIndex: 6, ...at(place.pill) }}
          initial={landed ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{
            delay: landed ? (reduced ? 0 : MOTION.label.delay + 0.12) : 0,
            duration: MOTION.label.duration,
          }}
        >
          <GotLabel
            text="GOT"
            style={{ position: 'relative', transform: 'rotate(-4deg)' }}
          />
        </motion.span>
      ) : null}
      {landed ? (
        <motion.span
          className="nt-burst"
          style={{
            position: 'absolute',
            right: u(-36),
            top: u(-44),
            zIndex: 7,
          }}
          {...burstAnimation(reduced)}
        >
          <Star label="GOT IT!" size={u(84)} fill="red" fontSize={15} />
        </motion.span>
      ) : null}
      {claim?.claimed ? (
        <motion.span
          style={{ position: 'absolute', zIndex: 7, ...claimStyle }}
          initial={reduced ? { opacity: 0 } : { scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={slapTransition(reduced)}
        >
          <ClaimedTag
            mine={claim.mine}
            style={{
              position: 'relative',
              transform: `rotate(${MOTION.claimed.rotate}deg)`,
            }}
          />
        </motion.span>
      ) : null}
      {caption ? (
        <motion.span
          className="nt-cap-wrap"
          style={captionStyle}
          initial={landed ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{
            delay: landed && !reduced ? MOTION.label.delay + 0.12 : 0,
          }}
        >
          <Caption title={caption.title} sub={caption.sub} />
        </motion.span>
      ) : null}
    </motion.div>
  )
}

function captionFor(
  item: GuestItem,
  sheet: SheetProps,
  ghost: boolean,
): { title: string; sub: string | null } | null {
  if (ghost) return { title: item.title, sub: 'peeled · in Got' }
  // B1·08: the Got sheet's caption sub is the date.
  if (sheet.mode === 'got')
    return { title: item.title, sub: gotDate(gotTime(item)) }
  // r2 §6: captions stay on in public, title + brand.
  return { title: item.title, sub: item.brand || null }
}

function Caption({
  title,
  sub,
  style,
}: {
  title: string
  sub: string | null
  style?: CSSProperties
}) {
  return (
    <span className="nt-cap" aria-hidden="true" style={style}>
      <b>{title}</b>
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

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  CheckCircleIcon,
  HandHeartIcon,
  LockSimpleIcon,
} from '@phosphor-icons/react'

import { stickerKind } from '#/lib/sticker/sheets'
import type { DotFill, StickerKind } from '#/lib/sticker/sheets'
import type { GuestItem } from '#/lib/guest-wishlist'

type ArtItem = Pick<GuestItem, 'id' | 'title' | 'imageUrl'> & {
  image?: Blob | null
}

/** Image source for an item: its URL, or an object URL for a guest upload. */
export function useItemSrc(item: ArtItem) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const blob = item.image ?? null
  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') {
      setBlobUrl(null)
      return
    }
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return blobUrl ?? item.imageUrl ?? null
}

/** Kind of sticker an item prints as. Guest uploads print as photo stickers. */
export function artKind(item: ArtItem, src: string | null): StickerKind {
  if (!src) return 'none'
  if (item.image) return 'photo'
  return stickerKind(src)
}

function initials(title: string) {
  return (
    title
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  )
}

/**
 * The sticker face: a die cut (baked white border), a legacy cut-out (white
 * border added by the #nt-kiss-cut filter) or a photo sticker (white frame).
 * Images are decorative: the button around it carries the name.
 */
export function StickerArt({
  item,
  rotate = 0,
  className,
  onAspect,
}: {
  item: ArtItem
  rotate?: number
  className?: string
  /** Natural width / height once the image loads. */
  onAspect?: (ratio: number) => void
}) {
  const src = useItemSrc(item)
  const kind = artKind(item, src)
  return (
    <span
      className={['nt-art', className].filter(Boolean).join(' ')}
      data-kind={kind}
      style={{ '--r': `${rotate}deg` } as CSSProperties}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={(event) => {
            const image = event.currentTarget
            if (onAspect && image.naturalWidth > 0 && image.naturalHeight > 0)
              onAspect(image.naturalWidth / image.naturalHeight)
          }}
        />
      ) : (
        <span aria-hidden="true">{initials(item.title)}</span>
      )}
    </span>
  )
}

/**
 * Ghost slot (r2 #13): the die silhouette filled rgba(29,29,31,.14) with a
 * 1.5px white die line at 55%. Die and cut-out images get the shape from
 * the #nt-ghost filter; photo stickers keep their rounded frame.
 */
export function Ghost({ item, rotate }: { item: ArtItem; rotate: number }) {
  const src = useItemSrc(item)
  const kind = artKind(item, src)
  const shaped = (kind === 'die' || kind === 'cutout') && src
  return (
    <span
      className="nt-ghost"
      data-shape={shaped ? 'die' : 'rect'}
      aria-hidden="true"
      style={{ '--r': `${rotate}deg` } as CSSProperties}
    >
      {shaped ? (
        <img
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          decoding="async"
        />
      ) : (
        <i />
      )}
    </span>
  )
}

/**
 * Faded mini (r2 §3): the cutout's silhouette at .14 ink, no colour. Uses
 * the #nt-sil filter so no separate silhouette PNG is needed.
 */
export function Silhouette({
  item,
  className,
}: {
  item: ArtItem
  className?: string
}) {
  const src = useItemSrc(item)
  const kind = artKind(item, src)
  const shaped = (kind === 'die' || kind === 'cutout') && src
  return (
    <span
      className={['nt-sil', className].filter(Boolean).join(' ')}
      data-shape={shaped ? 'die' : 'rect'}
      aria-hidden="true"
    >
      {shaped ? (
        <img
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          decoding="async"
        />
      ) : (
        <i />
      )}
    </span>
  )
}

export function PriceDot({
  label,
  fill,
  size,
  rotate,
  style,
  className,
}: {
  label: string
  fill: DotFill
  /** Diameter in px, or a CSS length (e.g. `calc(.05 * 100cqw)`). */
  size: number | string
  rotate: number
  style?: CSSProperties
  className?: string
}) {
  const diameter = typeof size === 'number' ? `${size}px` : size
  return (
    <span
      className={['nt-dot', className].filter(Boolean).join(' ')}
      data-fill={fill}
      aria-hidden="true"
      style={{
        width: diameter,
        height: diameter,
        fontSize: `max(11px, calc(${diameter} * 0.27))`,
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >
      {label}
    </span>
  )
}

/** 12-point star badge (NEW, GOT IT!) on a 100×100 box. */
export function starPoints(points = 12, inner = 0.8) {
  const vertices: Array<string> = []
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? 48 : 48 * inner
    const angle = (Math.PI * index) / points - Math.PI / 2
    vertices.push(
      `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`,
    )
  }
  return vertices.join(' ')
}

const STAR = starPoints()

export function Star({
  label,
  size,
  fill = 'yellow',
  rotate = 0,
  fontSize,
  style,
}: {
  label: string
  /** Diameter in px or a CSS length. */
  size: number | string
  fill?: 'yellow' | 'red'
  rotate?: number
  fontSize?: number | string
  style?: CSSProperties
}) {
  const diameter = typeof size === 'number' ? `${size}px` : size
  return (
    <span
      className="nt-star"
      aria-hidden="true"
      style={{
        width: diameter,
        height: diameter,
        transform: `rotate(${rotate}deg)`,
        color: fill === 'red' ? '#fff' : 'var(--nt-ink)',
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100">
        <polygon
          points={STAR}
          fill={fill === 'red' ? 'var(--nt-red)' : 'var(--nt-yellow)'}
          stroke="#fff"
          strokeWidth={3}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <b style={fontSize === undefined ? undefined : { fontSize }}>{label}</b>
    </span>
  )
}

export function GotLabel({
  text,
  style,
}: {
  text: string
  style?: CSSProperties
}) {
  return (
    <span className="nt-gl" style={style} aria-hidden="true">
      <CheckCircleIcon weight="fill" />
      {text}
    </span>
  )
}

export function ClaimedTag({
  style,
  mine = false,
}: {
  style?: CSSProperties
  /** B3·04: the visitor's own claim is an ink pill with hand-heart. */
  mine?: boolean
}) {
  return (
    <span
      className="nt-claimed"
      data-mine={mine ? 'true' : undefined}
      style={style}
    >
      {mine ? (
        <HandHeartIcon weight="fill" aria-hidden="true" />
      ) : (
        <LockSimpleIcon weight="bold" aria-hidden="true" />
      )}
      {mine ? 'Claimed by you' : 'CLAIMED'}
    </span>
  )
}

/**
 * SVG filters for legacy cut-outs (`c-` keys) that have no baked border:
 * dilate the alpha, flood white, then draw the image on top.
 */
export function KissCutFilters() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      style={{ position: 'absolute' }}
    >
      <defs>
        {[
          ['nt-kiss-cut', 6],
          ['nt-kiss-cut-lg', 12],
        ].map(([id, radius]) => (
          <filter
            key={id}
            id={String(id)}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={radius}
              result="grown"
            />
            <feFlood floodColor="#fff" />
            <feComposite in2="grown" operator="in" result="border" />
            <feMerge>
              <feMergeNode in="border" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
        {/* r2 #13 ghost: alpha → .14 ink fill + 1.5px white die line at 55%. */}
        <filter id="nt-ghost" x="-5%" y="-5%" width="110%" height="110%">
          <feComponentTransfer in="SourceAlpha" result="shape">
            <feFuncA type="discrete" tableValues="0 1 1 1" />
          </feComponentTransfer>
          <feMorphology
            in="shape"
            operator="erode"
            radius="1.5"
            result="inner"
          />
          <feComposite in="shape" in2="inner" operator="out" result="ring" />
          <feFlood floodColor="#1D1D1F" floodOpacity="0.14" />
          <feComposite in2="inner" operator="in" result="fill" />
          <feFlood floodColor="#fff" floodOpacity="0.55" />
          <feComposite in2="ring" operator="in" result="line" />
          <feMerge>
            <feMergeNode in="fill" />
            <feMergeNode in="line" />
          </feMerge>
        </filter>
        {/* r2 §3 faded mini: silhouette only. */}
        <filter id="nt-sil" x="0" y="0" width="100%" height="100%">
          <feComponentTransfer in="SourceAlpha" result="shape">
            <feFuncA type="discrete" tableValues="0 1 1 1" />
          </feComponentTransfer>
          <feFlood floodColor="#1D1D1F" floodOpacity="0.14" />
          <feComposite in2="shape" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}

/** Initials for the avatar: "Sean Motanya" → "SM". */
export function nameInitials(name: string) {
  return initials(name)
}

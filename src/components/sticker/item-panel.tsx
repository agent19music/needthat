import * as Menu from '@radix-ui/react-dropdown-menu'
import { motion, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ArrowUpRightIcon,
  CalendarBlankIcon,
  DotsThreeIcon,
  HandGrabbingIcon,
  HandPointingIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react'

import { shouldCommitPeel } from '#/components/sticker/motion'
import { PriceDot, Star, StickerArt } from '#/components/sticker/sticker'
import { displayLink } from '#/lib/discovery/link-reader'
import { formatPrice, isNew, sheetKicker } from '#/lib/sticker/sheets'
import type { SheetFill } from '#/lib/sticker/sheets'
import type { GuestItem } from '#/lib/guest-wishlist'

export type PanelSheet = {
  fill: SheetFill
  tag: string
  number: number
  stickers: ReadonlyArray<GuestItem>
}

const ADDED = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** S4 item detail. Full screen on 390, a 480 right panel on desktop. */
export function ItemPanel({
  item,
  sheet,
  now,
  showPrice,
  onClose,
  onPeel,
  onUnpeel,
  onEdit,
  onDelete,
  onArrange,
  onOpen,
  onSeeSheet,
}: {
  item: GuestItem
  sheet: PanelSheet
  now: number
  showPrice: boolean
  onClose: () => void
  onPeel: (item: GuestItem, from: DOMRect) => void
  onUnpeel: (item: GuestItem) => void
  onEdit: (item: GuestItem) => void
  onDelete: (item: GuestItem) => void
  onArrange?: () => void
  onOpen: (item: GuestItem) => void
  onSeeSheet: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const hero = useRef<HTMLDivElement>(null)
  const got = item.status === 'purchased'
  const price = showPrice ? formatPrice(item.price) : null
  const fresh = isNew(item, now)
  const wanted = sheet.stickers.filter((entry) => entry.status !== 'purchased')
  const index = sheet.stickers.findIndex((entry) => entry.id === item.id)
  const others = sheet.stickers
    .filter((entry) => entry.id !== item.id)
    .slice(0, 4)
  const next =
    wanted.length > 1
      ? wanted[
          (wanted.findIndex((entry) => entry.id === item.id) + 1) %
            wanted.length
        ]
      : null

  function peel() {
    const rect = hero.current?.getBoundingClientRect()
    if (rect) onPeel(item, rect)
  }

  return (
    <>
      <div className="nt-item-top" data-fill={sheet.fill}>
        <div className="nt-item-nav">
          <button
            type="button"
            className="nt-ib"
            aria-label="Back to the sheet"
            onClick={onClose}
          >
            <ArrowLeftIcon aria-hidden="true" />
          </button>
          <span className="nt-lab">{sheet.tag}</span>
          <Menu.Root>
            <Menu.Trigger asChild>
              <button type="button" className="nt-ib" aria-label="More">
                <DotsThreeIcon weight="bold" aria-hidden="true" />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                className="nt-layer nt-dd"
                align="end"
                sideOffset={8}
              >
                {next ? (
                  <Menu.Item
                    className="nt-dd-item"
                    onSelect={() => onOpen(next)}
                  >
                    Next sticker
                  </Menu.Item>
                ) : null}
                <Menu.Item className="nt-dd-item" onSelect={() => onEdit(item)}>
                  Edit details
                </Menu.Item>
                {onArrange && sheet.stickers.length > 1 ? (
                  <Menu.Item className="nt-dd-item" onSelect={onArrange}>
                    Arrange sheet
                  </Menu.Item>
                ) : null}
                <Menu.Item
                  className="nt-dd-item"
                  data-tone="red"
                  onSelect={() => onDelete(item)}
                >
                  Delete sticker
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
        <motion.div
          ref={hero}
          className="nt-hero"
          drag={got ? false : 'y'}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.9, bottom: 0.1 }}
          dragSnapToOrigin
          whileDrag={reduced ? undefined : { scale: 1.04, rotate: -2 }}
          onDragEnd={(_, info) => {
            if (shouldCommitPeel(info.offset.y, info.velocity.y)) peel()
          }}
        >
          <StickerArt item={item} rotate={-6} />
          {price ? (
            <PriceDot
              label={price}
              fill="red"
              size={92}
              rotate={10}
              style={{ right: -8, top: -26, fontSize: 26 }}
            />
          ) : null}
          {fresh ? (
            <Star
              label="NEW"
              size={62}
              rotate={-12}
              style={{ left: -8, top: -6 }}
            />
          ) : null}
        </motion.div>
        <p className="nt-prt">
          <span>
            {sheetKicker(sheet.number)} · sticker {index + 1} of{' '}
            {sheet.stickers.length}
          </span>
          {got ? null : (
            <span>
              <HandPointingIcon aria-hidden="true" />
              Drag up to peel
            </span>
          )}
        </p>
      </div>
      <div className="nt-pane">
        <h1>{item.title}</h1>
        {item.brand ? <p className="nt-brand">{item.brand}</p> : null}
        {item.notes.trim() ? (
          <div className="nt-note">
            <span className="nt-tape" aria-hidden="true" />
            <small>NOTE</small>
            <p>{item.notes}</p>
          </div>
        ) : null}
        <div className="nt-chips">
          {item.sourceUrl ? (
            <a
              className="nt-chip"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              style={{ transform: 'rotate(-1deg)' }}
            >
              {displayLink(item.sourceUrl)}
              <ArrowUpRightIcon size={13} aria-hidden="true" />
            </a>
          ) : null}
          <span className="nt-chip" style={{ transform: 'rotate(1.5deg)' }}>
            <CalendarBlankIcon aria-hidden="true" />
            Added <span>{ADDED.format(new Date(item.createdAt))}</span>
          </span>
        </div>
        {others.length > 0 ? (
          <div className="nt-also">
            <div className="nt-also-head">
              Also on this sheet
              <button type="button" onClick={onSeeSheet}>
                See sheet →
              </button>
            </div>
            <div className="nt-also-row">
              {others.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  className="nt-mini"
                  aria-label={other.title}
                  onClick={() => onOpen(other)}
                >
                  <StickerArt item={other} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="nt-act">
        {got ? (
          <button
            type="button"
            className="nt-cta"
            data-tone="ink"
            onClick={() => onUnpeel(item)}
          >
            <ArrowCounterClockwiseIcon weight="bold" aria-hidden="true" />
            Move back to wants
          </button>
        ) : (
          <button type="button" className="nt-cta" onClick={peel}>
            <HandGrabbingIcon weight="bold" aria-hidden="true" />
            Peel off · Got it
          </button>
        )}
        <button
          type="button"
          className="nt-round"
          aria-label="Edit details"
          onClick={() => onEdit(item)}
        >
          <PencilSimpleIcon aria-hidden="true" />
        </button>
        {item.sourceUrl ? (
          <a
            className="nt-round"
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the shop link"
          >
            <ArrowSquareOutIcon aria-hidden="true" />
          </a>
        ) : null}
        <button
          type="button"
          className="nt-round"
          data-tone="red"
          aria-label="Delete sticker"
          onClick={() => onDelete(item)}
        >
          <TrashIcon aria-hidden="true" />
        </button>
      </div>
    </>
  )
}

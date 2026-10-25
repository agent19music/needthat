import * as Menu from '@radix-ui/react-dropdown-menu'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  ArrowUpRightIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CurrencyDollarIcon,
  DotsThreeIcon,
  ExportIcon,
  FolderSimpleIcon,
  HandGrabbingIcon,
  HandPointingIcon,
  LinkIcon,
  PencilSimpleIcon,
  PrinterIcon,
  RowsIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'

import { shouldCommitPeel } from '#/components/sticker/motion'
import { Overlay } from '#/components/sticker/overlays'
import {
  PriceDot,
  Silhouette,
  Star,
  StickerArt,
} from '#/components/sticker/sticker'
import { linkChip } from '#/lib/sticker/link-chip'
import {
  addedDate,
  formatPrice,
  newBadgeIds,
  sheetKicker,
} from '#/lib/sticker/sheets'
import { markOpened } from '#/lib/sticker/opened'
import type { SheetFill } from '#/lib/sticker/sheets'
import type { GuestItem } from '#/lib/guest-wishlist'

/** A sheet the sticker can move to; `id` null is "No category". */
export type MoveTarget = { id: string | null; tag: string }

export type PanelSheet = {
  fill: SheetFill
  tag: string
  number: number
  stickers: ReadonlyArray<GuestItem>
}

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
  onShare,
  moveTargets = [],
  onMove,
  onEditPrice,
  onCopyLink,
  onPrintSticker,
  wide,
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
  /** B2·04: share lives in the 1440 header. */
  onShare?: () => void
  /** B2·04 / B2·05 overflow: Move to sheet (C41). */
  moveTargets?: ReadonlyArray<MoveTarget>
  onMove?: (item: GuestItem, categoryId: string | null) => void
  /** B2·04 overflow: Edit price (C42) opens the B2·03 price sheet. */
  onEditPrice?: (item: GuestItem) => void
  /** Copy link (C43): copies the shop link. */
  onCopyLink?: (item: GuestItem) => void
  /** B2·04 bottom bar: white "Print sticker". */
  onPrintSticker?: (item: GuestItem) => void
  wide?: boolean
}) {
  const reduced = useReducedMotion() ?? false
  // B2·05: the 390 "…" opens a bottom sheet. Move: 440 modal wide, sheet at 390.
  const [more, setMore] = useState(false)
  const [moving, setMoving] = useState(false)
  const canMove = Boolean(onMove) && moveTargets.length > 0
  const canArrange = Boolean(onArrange) && sheet.stickers.length > 1
  // r4: one item menu (Edit price, Mark as got, Move, Copy link, Arrange,
  // divider, Remove); each panel drops only what has its own button there.
  // The 390 bar has its own bin (Delete sticker), so Remove only shows wide.
  // r6: both bars have "Peel off · Got it", so neither menu has Mark as got.
  const ownDelete = !wide
  const hero = useRef<HTMLDivElement>(null)
  const got = item.status === 'purchased'
  const price = showPrice ? formatPrice(item.price) : null
  // r3: same cap as the sheet (two newest in the 72h window).
  const fresh = newBadgeIds(sheet.stickers, now).has(item.id)
  // r2 B2·04: "N of M" counts wanted only; prev/next skip got stickers.
  const wanted = sheet.stickers.filter((entry) => entry.status !== 'purchased')
  const position = wanted.findIndex((entry) => entry.id === item.id)
  const step = (by: number) =>
    wanted.length > 1 && position >= 0
      ? wanted[(position + by + wanted.length) % wanted.length]
      : null
  const next = step(1)
  const prev = step(-1)
  // r2 §3: wanted first (priority order), then got; max 3; current excluded.
  const rest = [
    ...wanted.filter((entry) => entry.id !== item.id),
    ...sheet.stickers.filter(
      (entry) => entry.status === 'purchased' && entry.id !== item.id,
    ),
  ]
  const others = rest.slice(0, 3)
  const count = position >= 0 ? `${position + 1} of ${wanted.length}` : null

  // NEW rule: opening a sticker clears its badge.
  useEffect(() => {
    markOpened(item.id)
  }, [item.id])

  function peel() {
    const rect = hero.current?.getBoundingClientRect()
    if (rect) onPeel(item, rect)
  }

  return (
    <>
      <div
        className="nt-item-top"
        data-fill={sheet.fill}
        data-layout={wide ? 'wide' : undefined}
      >
        {wide ? (
          <div className="nt-item-nav" data-layout="wide">
            <button
              type="button"
              className="nt-ib"
              aria-label="Close"
              onClick={onClose}
            >
              <XIcon weight="bold" aria-hidden="true" />
            </button>
            <span className="nt-item-kicker">
              {sheet.tag}
              {count ? ` · ${count}` : null}
            </span>
            {prev ? (
              <button
                type="button"
                className="nt-ib"
                aria-label="Previous sticker"
                onClick={() => onOpen(prev)}
              >
                <CaretLeftIcon weight="bold" aria-hidden="true" />
              </button>
            ) : null}
            {next ? (
              <button
                type="button"
                className="nt-ib"
                aria-label="Next sticker"
                onClick={() => onOpen(next)}
              >
                <CaretRightIcon weight="bold" aria-hidden="true" />
              </button>
            ) : null}
            {onShare ? (
              <button
                type="button"
                className="nt-ib"
                aria-label="Share sheet"
                onClick={onShare}
              >
                <ExportIcon aria-hidden="true" />
              </button>
            ) : null}
            <Menu.Root>
              <Menu.Trigger asChild>
                <button type="button" className="nt-ib" aria-label="More">
                  <DotsThreeIcon weight="bold" aria-hidden="true" />
                </button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content
                  className="nt-layer nt-dd nt-ovf"
                  align="end"
                  sideOffset={8}
                >
                  {/* r5: Edit details leads the 1440 menu (390 has the pencil). */}
                  <Menu.Item
                    className="nt-dd-item"
                    onSelect={() => onEdit(item)}
                  >
                    <PencilSimpleIcon aria-hidden="true" />
                    Edit details
                  </Menu.Item>
                  {onEditPrice ? (
                    <Menu.Item
                      className="nt-dd-item"
                      onSelect={() => onEditPrice(item)}
                    >
                      <CurrencyDollarIcon aria-hidden="true" />
                      Edit price
                    </Menu.Item>
                  ) : null}
                  {/* r6: no Mark as got wide; "Peel off · Got it" is in the bar. */}
                  {canMove ? (
                    <Menu.Item
                      className="nt-dd-item"
                      onSelect={() => setMoving(true)}
                    >
                      <FolderSimpleIcon aria-hidden="true" />
                      Move to sheet
                    </Menu.Item>
                  ) : null}
                  {onCopyLink && item.sourceUrl ? (
                    <Menu.Item
                      className="nt-dd-item"
                      onSelect={() => onCopyLink(item)}
                    >
                      <LinkIcon aria-hidden="true" />
                      Copy link
                    </Menu.Item>
                  ) : null}
                  {canArrange ? (
                    <Menu.Item className="nt-dd-item" onSelect={onArrange}>
                      <RowsIcon aria-hidden="true" />
                      Arrange sheet
                    </Menu.Item>
                  ) : null}
                  {ownDelete ? null : (
                    <>
                      <Menu.Separator className="nt-dd-sep" />
                      <Menu.Item
                        className="nt-dd-item"
                        data-tone="red"
                        onSelect={() => onDelete(item)}
                      >
                        <TrashIcon aria-hidden="true" />
                        Remove
                      </Menu.Item>
                    </>
                  )}
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </div>
        ) : (
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
            <button
              type="button"
              className="nt-ib"
              aria-label="More"
              aria-haspopup="dialog"
              onClick={() => setMore(true)}
            >
              <DotsThreeIcon weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
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
        <p className="nt-prt" hidden={wide}>
          <span>
            {sheetKicker(sheet.number)}
            {count ? ` · sticker ${count}` : null}
          </span>
          {got ? null : (
            <span>
              <HandPointingIcon aria-hidden="true" />
              Drag up to peel
            </span>
          )}
        </p>
      </div>
      <div className="nt-pane" data-layout={wide ? 'wide' : undefined}>
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
              <LinkIcon aria-hidden="true" />
              <span className="nt-chip-link">{linkChip(item.sourceUrl)}</span>
              <ArrowUpRightIcon size={13} aria-hidden="true" />
            </a>
          ) : null}
          <span className="nt-chip" style={{ transform: 'rotate(1.5deg)' }}>
            <CalendarBlankIcon aria-hidden="true" />
            Added <span>{addedDate(item.createdAt, now)}</span>
          </span>
        </div>
        {others.length > 0 ? (
          <div className="nt-also">
            <div className="nt-also-head">Also on this sheet</div>
            <div className="nt-also-row">
              {others.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  className="nt-mini"
                  data-got={other.status === 'purchased' ? 'true' : undefined}
                  aria-label={other.title}
                  onClick={() => onOpen(other)}
                >
                  {other.status === 'purchased' ? (
                    <>
                      <Silhouette item={other} />
                      <CheckCircleIcon
                        weight="fill"
                        className="nt-mini-check"
                        aria-hidden="true"
                      />
                    </>
                  ) : (
                    <StickerArt item={other} />
                  )}
                </button>
              ))}
              {rest.length > others.length ? (
                <button
                  type="button"
                  className="nt-also-more"
                  onClick={onSeeSheet}
                >
                  See sheet
                  <ArrowRightIcon aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="nt-act" data-layout={wide ? 'wide' : undefined}>
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
          <button
            type="button"
            className="nt-cta"
            data-tone={wide ? 'yellow' : undefined}
            onClick={peel}
          >
            <HandGrabbingIcon weight="bold" aria-hidden="true" />
            Peel off · Got it
          </button>
        )}
        {wide && onPrintSticker ? (
          <button
            type="button"
            className="nt-pill nt-print-sticker"
            data-tone="white"
            onClick={() => onPrintSticker(item)}
          >
            <PrinterIcon aria-hidden="true" />
            Print sticker
          </button>
        ) : null}
        {wide ? null : (
          <>
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
          </>
        )}
      </div>
      {wide ? null : (
        <Overlay
          open={more}
          onClose={() => setMore(false)}
          kind="bottom"
          title="More"
          className="nt-ovf-sheet"
        >
          <div className="nt-ovf-head">
            <span className="nt-ovf-thumb" aria-hidden="true">
              <StickerArt item={item} />
            </span>
            <div>
              <b>{item.title}</b>
              <small>{[sheet.tag, price].filter(Boolean).join(' · ')}</small>
            </div>
          </div>
          <div className="nt-dd-sep" />
          {/* r4: the shared item menu, minus Remove when the 390 bar
              already has its own bin (Delete sticker). */}
          <div role="menu" aria-label="More">
            {onEditPrice ? (
              <SheetRow
                onClick={() => {
                  setMore(false)
                  onEditPrice(item)
                }}
              >
                <CurrencyDollarIcon aria-hidden="true" />
                Edit price
              </SheetRow>
            ) : null}
            {/* r6: no Mark as got; the 390 bar has "Peel off · Got it". */}
            {canMove ? (
              <SheetRow
                onClick={() => {
                  setMore(false)
                  setMoving(true)
                }}
              >
                <FolderSimpleIcon aria-hidden="true" />
                Move to sheet
              </SheetRow>
            ) : null}
            {onCopyLink && item.sourceUrl ? (
              <SheetRow
                onClick={() => {
                  setMore(false)
                  onCopyLink(item)
                }}
              >
                <LinkIcon aria-hidden="true" />
                Copy link
              </SheetRow>
            ) : null}
            {canArrange && onArrange ? (
              <SheetRow
                onClick={() => {
                  setMore(false)
                  onArrange()
                }}
              >
                <RowsIcon aria-hidden="true" />
                Arrange sheet
              </SheetRow>
            ) : null}
            {ownDelete ? null : (
              <>
                <div className="nt-dd-sep" />
                <SheetRow
                  tone="red"
                  onClick={() => {
                    setMore(false)
                    onDelete(item)
                  }}
                >
                  <TrashIcon aria-hidden="true" />
                  Remove
                </SheetRow>
              </>
            )}
          </div>
        </Overlay>
      )}
      {onMove ? (
        <Overlay
          open={moving}
          onClose={() => setMoving(false)}
          // r5: a bottom sheet at 390 like the other 390 sheets; 440 modal wide.
          kind={wide ? 'modal' : 'bottom'}
          title="Move to sheet"
          className="nt-move"
        >
          <div className="nt-confirm-head">
            <h2>Move to sheet</h2>
            <button
              type="button"
              className="nt-ib"
              aria-label="Close"
              onClick={() => setMoving(false)}
            >
              <XIcon aria-hidden="true" />
            </button>
          </div>
          <div role="radiogroup" aria-label="Move to sheet">
            {moveTargets.map((target) => {
              const checked = (item.categoryId ?? null) === target.id
              return (
                <SheetRow
                  key={target.id ?? ''}
                  role="radio"
                  checked={checked}
                  onClick={() => {
                    setMoving(false)
                    if (!checked) onMove(item, target.id)
                  }}
                >
                  {target.tag}
                  {checked ? (
                    <CheckIcon
                      className="nt-dd-r"
                      weight="bold"
                      aria-hidden="true"
                    />
                  ) : null}
                </SheetRow>
              )
            })}
          </div>
        </Overlay>
      ) : null}
    </>
  )
}

/** One 52h row of the B2·05 sheet. */
function SheetRow({
  children,
  onClick,
  tone,
  role = 'menuitem',
  checked,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'red'
  role?: 'menuitem' | 'radio'
  checked?: boolean
}) {
  return (
    <button
      type="button"
      className="nt-sort-row nt-ovf-row"
      role={role}
      aria-checked={role === 'radio' ? Boolean(checked) : undefined}
      data-tone={tone}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

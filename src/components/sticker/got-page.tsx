import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import { EASE, GESTURE, MOTION } from '#/components/sticker/motion'
import { Sheet } from '#/components/sticker/sheet'
import {
  clampPage,
  formatTotal,
  gotCountLabel,
  orderGot,
  paginateGot,
  sheetMeta,
} from '#/lib/sticker/sheets'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

/**
 * Got page (r2 B1·09 / #25 / #26): full screen with an X top-left and the
 * "Got" title, the yellow sheet on the Got zig-zag below. 390 uses Z1
 * (head_bottom 156, low GOT pills, date captions); 1440 uses the wall.
 * The count line holds its old value until the sticker lands (+120ms, #22).
 */
export function GotPage({
  items,
  categories,
  now,
  showPrice,
  perPage,
  page,
  onPage,
  previousCount,
  landingId,
  landedId,
  onOpen,
  onClose,
  wide = false,
  top,
}: {
  items: ReadonlyArray<GuestItem>
  categories: ReadonlyArray<GuestCategory>
  now: number
  showPrice: boolean
  perPage: number
  page: number
  onPage: (page: number) => void
  /** Count before the last peel; shown until the sticker lands. */
  previousCount: number | null
  landingId: string | null
  landedId: string | null
  onOpen: (item: GuestItem, opener: HTMLElement) => void
  onClose?: () => void
  wide?: boolean
  top?: ReactNode
}) {
  const reduced = useReducedMotion() ?? false
  const got = orderGot(items.filter((item) => item.status === 'purchased'))
  const pages = paginateGot(got, perPage)
  const current = clampPage(page, pages.length)
  const shown = pages[current]?.items ?? []
  // #22: the count and year pill change only after the landing.
  // In flight, then +120ms after the landing (previousCount clears then).
  const pending = landingId ?? (previousCount !== null ? landedId : null)
  const counted = pending ? got.filter((item) => item.id !== pending) : got
  const total = showPrice ? formatTotal(counted) : null

  function turn(next: number) {
    const target = clampPage(next, pages.length)
    if (target !== current) onPage(target)
  }

  return (
    <div className="nt-gotpage" data-wide={wide ? 'true' : undefined}>
      {top}
      {onClose ? (
        <div className="nt-got-bar">
          <button
            type="button"
            className="nt-ib"
            aria-label="Close"
            onClick={onClose}
          >
            <XIcon weight="bold" aria-hidden="true" />
          </button>
          <h2>Got</h2>
          <span aria-hidden="true" />
        </div>
      ) : null}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={current}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reduced
              ? MOTION.reduced.duration
              : MOTION.pageRise.duration,
            ease: EASE.enter,
          }}
          drag={pages.length > 1 && !reduced ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          dragSnapToOrigin
          style={{ touchAction: 'pan-y' }}
          onDragEnd={(_, info) => {
            if (
              info.offset.x < -GESTURE.distance ||
              info.velocity.x < -GESTURE.velocity
            )
              turn(current + 1)
            else if (
              info.offset.x > GESTURE.distance ||
              info.velocity.x > GESTURE.velocity
            )
              turn(current - 1)
          }}
        >
          <Sheet
            id="nt-got-page"
            fill="yellow"
            kicker="GOT PAGE"
            title="Got"
            meta={sheetMeta(counted.length, total, { compact: true })}
            metaPill={counted.length > 0 ? gotCountLabel(counted, now) : null}
            variant={wide ? 'wall' : 'got-column'}
            stickers={shown}
            mode="got"
            now={now}
            showPrice={showPrice}
            categories={categories}
            allItems={items}
            fab={false}
            landingId={landingId}
            landedId={landedId}
            onOpen={onOpen}
          />
        </motion.div>
      </AnimatePresence>
      {pages.length > 1 ? (
        <nav className="nt-pager" aria-label="Got pages">
          <button
            type="button"
            className="nt-ib"
            aria-label="Newer page"
            disabled={current === 0}
            onClick={() => turn(current - 1)}
          >
            <CaretLeftIcon weight="bold" aria-hidden="true" />
          </button>
          <span aria-live="polite">
            Page {current + 1} of {pages.length}
          </span>
          <button
            type="button"
            className="nt-ib"
            aria-label="Older page"
            disabled={current >= pages.length - 1}
            onClick={() => turn(current + 1)}
          >
            <CaretRightIcon weight="bold" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  )
}

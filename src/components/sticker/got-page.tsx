import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import { EASE, GESTURE, MOTION } from '#/components/sticker/motion'
import { Sheet } from '#/components/sticker/sheet'
import {
  clampPage,
  formatTotal,
  orderGot,
  paginateGot,
  sheetMeta,
} from '#/lib/sticker/sheets'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

/**
 * S5 Got page: the yellow sheet as a book, newest first (Bau Q13). Pages
 * turn with the pager or a sideways swipe; a freshly stuck sticker opens
 * on its page (the board passes `page`).
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
  top,
}: {
  items: ReadonlyArray<GuestItem>
  categories: ReadonlyArray<GuestCategory>
  now: number
  showPrice: boolean
  perPage: number
  page: number
  onPage: (page: number) => void
  /** Count before the last peel, for the "3 → 4 got" pill. */
  previousCount: number | null
  landingId: string | null
  landedId: string | null
  onOpen: (item: GuestItem, opener: HTMLElement) => void
  top?: ReactNode
}) {
  const reduced = useReducedMotion() ?? false
  const got = orderGot(items.filter((item) => item.status === 'purchased'))
  const pages = paginateGot(got, perPage)
  const current = clampPage(page, pages.length)
  const shown = pages[current]?.items ?? []
  const newest = got[0]?.id ?? null
  const total = showPrice ? formatTotal(got) : null
  const count = got.length

  function turn(next: number) {
    const target = clampPage(next, pages.length)
    if (target !== current) onPage(target)
  }

  return (
    <div className="nt-gotpage">
      {top}
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
            meta={sheetMeta(count, total)}
            variant="page"
            stickers={shown}
            mode="got"
            now={now}
            showPrice={showPrice}
            categories={categories}
            allItems={items}
            newestGotId={newest}
            landingId={landingId}
            landedId={landedId}
            onOpen={onOpen}
          >
            {count > 0 ? (
              <span className="nt-cnt" data-place="sheet">
                {previousCount !== null && previousCount !== count ? (
                  <>
                    <s>{previousCount}</s> → {count} got
                  </>
                ) : (
                  `${count} got`
                )}
              </span>
            ) : null}
          </Sheet>
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

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'

import {
  EASE,
  MOTION,
  flyKeyframes,
  flyTransition,
} from '#/components/sticker/motion'
import { StickerArt } from '#/components/sticker/sticker'
import type { GuestItem } from '#/lib/guest-wishlist'

export type OverlayKind = 'panel' | 'bottom'

/**
 * Item detail / Got page / print / share: a right panel 480 wide on desktop
 * (Bau Q9), full screen on 390. Claim and delete: bottom sheets.
 */
export function Overlay({
  open,
  onClose,
  kind,
  title,
  description,
  children,
  fill,
  className,
}: {
  open: boolean
  onClose: () => void
  kind: OverlayKind
  title: string
  description?: string
  children: ReactNode
  fill?: string
  className?: string
}) {
  const reduced = useReducedMotion() ?? false
  const enter =
    kind === 'bottom'
      ? {
          initial: reduced ? { opacity: 0 } : { y: '100%' },
          animate: { y: 0, opacity: 1 },
        }
      : {
          initial: reduced ? { opacity: 0 } : { opacity: 0, x: 32 },
          animate: { opacity: 1, x: 0 },
        }
  const transition = reduced
    ? { duration: MOTION.reduced.duration }
    : { duration: 0.24, ease: EASE.enter }
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal key="overlay" forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="nt-scrim"
                data-kind={kind}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduced ? MOTION.reduced.duration : 0.18,
                }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              aria-describedby={description ? undefined : undefined}
              onOpenAutoFocus={(event) => {
                // Focus the panel itself, not its first button.
                event.preventDefault()
                ;(event.currentTarget as HTMLElement | null)?.focus()
              }}
            >
              <motion.div
                className={[
                  'nt-layer',
                  kind === 'bottom' ? 'nt-bottom' : 'nt-panel',
                  className,
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-fill={fill}
                initial={enter.initial}
                animate={enter.animate}
                exit={{
                  ...enter.initial,
                  transition: {
                    duration: reduced ? MOTION.reduced.duration : 0.16,
                  },
                }}
                transition={transition}
              >
                <DialogPrimitive.Title className="nt-sr">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="nt-sr">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
                {kind === 'bottom' ? (
                  <span className="nt-grab" aria-hidden="true" />
                ) : null}
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

export const OverlayClose = DialogPrimitive.Close

export type ToastState =
  | { kind: 'got'; id: number; item: GuestItem }
  | { kind: 'error'; id: number; message: string; retry?: () => void }
  | { kind: 'info'; id: number; message: string; undo?: () => void }

/** Ink pill toast (§8). Undo / Retry sit on the right. */
export function Toast({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: ToastState | null
  onUndo?: () => void
  onDismiss: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div className="nt-layer" aria-live="polite">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            className="nt-toast"
            role="status"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduced ? MOTION.reduced.duration : 0.2,
              ease: EASE.enter,
            }}
          >
            {toast.kind === 'error' ? (
              <WarningCircleIcon weight="fill" aria-hidden="true" />
            ) : (
              <CheckCircleIcon weight="fill" aria-hidden="true" />
            )}
            <span>
              {toast.kind === 'got' ? 'Got it. Stuck in Got' : toast.message}
            </span>
            {toast.kind === 'got' && onUndo ? (
              <button type="button" onClick={onUndo}>
                Undo
              </button>
            ) : null}
            {toast.kind === 'info' && toast.undo ? (
              <button type="button" onClick={toast.undo}>
                Undo
              </button>
            ) : null}
            {toast.kind === 'error' ? (
              <button
                type="button"
                onClick={() => {
                  onDismiss()
                  toast.retry?.()
                }}
              >
                {toast.retry ? 'Retry' : 'OK'}
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

export type Flight = {
  item: GuestItem
  from: DOMRect
  to: DOMRect
  rotate: number
}

/** The peeled sticker flying along the arc to its Got slot (§7). */
export function FlyLayer({
  flight,
  onDone,
}: {
  flight: Flight | null
  onDone: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || !flight) return null
  const { from, to } = flight
  const keyframes = flyKeyframes(
    { x: from.left, y: from.top },
    {
      x: to.left + (to.width - from.width) / 2,
      y: to.top + (to.height - from.height) / 2,
    },
  )
  const scale = from.width > 0 ? to.width / from.width : 1
  return createPortal(
    <div className="nt-layer" aria-hidden="true">
      <motion.div
        className="nt-fly"
        style={{ width: from.width, height: from.height }}
        initial={
          reduced
            ? { x: to.left, y: to.top, opacity: 0, scale }
            : {
                x: from.left,
                y: from.top,
                scale: 1,
                rotate: MOTION.lift.rotate,
              }
        }
        animate={
          reduced
            ? { opacity: [0, 1] }
            : {
                x: keyframes.x,
                y: keyframes.y,
                scale: [1, 1 + (scale - 1) * 0.5, scale],
                rotate: [MOTION.lift.rotate, -2, 0],
              }
        }
        transition={flyTransition(reduced)}
        onAnimationComplete={onDone}
      >
        <StickerArt item={flight.item} rotate={flight.rotate} />
      </motion.div>
    </div>,
    document.body,
  )
}

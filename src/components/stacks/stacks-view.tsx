import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeftIcon,
  ArrowsDownUpIcon,
  CheckIcon,
  LinkSimpleIcon,
  PlusIcon,
} from '@phosphor-icons/react'

import { Arrange } from '#/components/stacks/arrange'
import { DetailSheet } from '#/components/stacks/detail-sheet'
import { CardFace } from '#/components/stacks/pile-card'
import { Pile } from '#/components/stacks/pile'
import { Strip } from '#/components/stacks/strip'
import { instant, t } from '#/components/stacks/tokens'
import {
  GOT_TIMELINE,
  PILE_DEPTH,
  buildPiles,
  categoryTag,
  gotTime,
  orderGot,
  orderStack,
  stripItems,
  stripPosition,
} from '#/lib/stacks/stacks'
import type { PileModel } from '#/lib/stacks/stacks'
import { topPosition } from '#/lib/wishlist/order'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'
import './stacks.css'

type Opened = { kind: 'got' } | { kind: 'unsorted' } | null

export type StacksViewProps = {
  items: ReadonlyArray<GuestItem>
  categories: ReadonlyArray<GuestCategory>
  ready: boolean
  selectedCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  /** Flip wanted ↔ got. Resolves once saved. */
  onToggleGot: (item: GuestItem) => Promise<void>
  onSave: (item: GuestItem) => Promise<void>
  onRemove: (item: GuestItem) => void
  onReorder: (stackIds: Array<string>) => Promise<void>
  onAdd: (categoryId: string | null) => void
  onNewCategory: () => void
  onCreateCategory: (name: string) => Promise<GuestCategory | string>
  onChangeImage: (item: GuestItem) => void
  /** Clock for "this year"; injectable for tests. */
  now?: number
}

export function StacksView(props: StacksViewProps) {
  const {
    items,
    categories,
    ready,
    selectedCategoryId,
    onSelectCategory,
    onToggleGot,
    onSave,
    onRemove,
    onReorder,
    onAdd,
    onNewCategory,
    onCreateCategory,
    onChangeImage,
    now = Date.now(),
  } = props
  const reduced = useReducedMotion() ?? false
  const [opened, setOpened] = useState<Opened>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [sheet, setSheet] = useState<{
    id: string
    mode: 'view' | 'edit'
  } | null>(null)
  const [arrange, setArrange] = useState<Array<string> | null>(null)
  const [arrangeError, setArrangeError] = useState<string | null>(null)
  const [toast, setToast] = useState<GuestItem | null>(null)
  const [gotBump, setGotBump] = useState(0)
  const [drag, setDrag] = useState<{
    item: GuestItem
    x: number
    y: number
    overId: string | null
  } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const opener = useRef<HTMLElement | null>(null)

  const category =
    categories.find((entry) => entry.id === selectedCategoryId) ?? null
  const piles = useMemo(
    () => buildPiles(items, categories),
    [items, categories],
  )

  const strip = useMemo<Array<GuestItem> | null>(() => {
    if (category) return stripItems(items, category.id)
    if (opened?.kind === 'got')
      return orderGot(items.filter((item) => item.status === 'purchased'))
    if (opened?.kind === 'unsorted') {
      const known = new Set(categories.map((entry) => entry.id))
      return orderStack(
        items.filter(
          (item) =>
            item.status !== 'purchased' &&
            (!item.categoryId || !known.has(item.categoryId)),
        ),
      )
    }
    return null
  }, [category, opened, items, categories])

  // A stack key so the strip resets focus when another stack opens.
  const stackKey = category?.id ?? opened?.kind ?? 'overview'
  useEffect(() => {
    setFocusIndex(0)
    setArrange(null)
  }, [stackKey])
  useEffect(() => {
    if (selectedCategoryId !== null) setOpened(null)
  }, [selectedCategoryId])

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const tag = category
    ? categoryTag(category.name)
    : opened?.kind === 'got'
      ? 'Got'
      : '#unsorted'
  const sheetItem = sheet
    ? (items.find((item) => item.id === sheet.id) ?? null)
    : null

  function back() {
    setOpened(null)
    setArrange(null)
    onSelectCategory(null)
  }

  function openPile(pile: PileModel) {
    opener.current = document.activeElement as HTMLElement | null
    if (pile.kind === 'category' || pile.kind === 'empty') {
      if (pile.kind === 'empty') {
        onSelectCategory(pile.id)
        onAdd(pile.id)
        return
      }
      onSelectCategory(pile.id)
    } else if (pile.kind === 'got') setOpened({ kind: 'got' })
    else setOpened({ kind: 'unsorted' })
  }

  function showToast(item: GuestItem) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast(item)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, GOT_TIMELINE.undoMs)
  }

  async function markGot(item: GuestItem) {
    if (item.status === 'purchased') {
      await onToggleGot(item)
      return
    }
    await onToggleGot(item)
    setGotBump((value) => value + 1)
    showToast(item)
  }

  async function undoGot() {
    const item = toast
    if (!item) return
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast(null)
    const current = items.find((entry) => entry.id === item.id)
    if (current && current.status === 'purchased') await onToggleGot(current)
  }

  async function finishArrange() {
    if (!arrange) return
    try {
      await onReorder(arrange)
      setArrange(null)
      setArrangeError(null)
    } catch {
      setArrangeError('That order could not be saved.')
    }
  }

  function startDrag(item: GuestItem, event: ReactPointerEvent) {
    setDrag({ item, x: event.clientX, y: event.clientY, overId: null })
  }

  useEffect(() => {
    if (!drag) return
    function target(x: number, y: number) {
      const element = document
        .elementsFromPoint(x, y)
        .find((node) => (node as HTMLElement).dataset.dropCategory) as
        HTMLElement | undefined
      return element?.dataset.dropCategory ?? null
    }
    function move(event: PointerEvent) {
      setDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              overId: target(event.clientX, event.clientY),
            }
          : current,
      )
    }
    function up(event: PointerEvent) {
      const overId = target(event.clientX, event.clientY)
      const current = dragRef.current
      setDrag(null)
      if (current && overId && overId !== current.item.categoryId) {
        void onSave({
          ...current.item,
          categoryId: overId,
          position: topPosition(items.map((item) => item.position ?? null)),
          updatedAt: Date.now(),
        }).catch(() => {})
      }
    }
    function cancel(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', cancel)
    }
  }, [drag !== null, onSave, items])

  if (!ready) return <StacksSkeleton />

  if (items.length === 0 && categories.length === 0)
    return (
      <div className="stk-empty-profile">
        <span className="stk-empty-pile" aria-hidden="true">
          <i />
          <i />
          <i>
            <LinkSimpleIcon size={20} />
          </i>
        </span>
        <p className="stk-empty-title">Nothing stacked yet</p>
        <p className="stk-empty-hint">
          Paste a link above. It lands on your first pile.
        </p>
      </div>
    )

  const gotItems = items.filter((item) => item.status === 'purchased')
  const thisYear = new Date(now).getFullYear()
  const gotCaption =
    gotItems.length > 0 &&
    gotItems.every((item) => new Date(gotTime(item)).getFullYear() === thisYear)
      ? 'this year'
      : undefined

  if (strip) {
    const wanted = strip.filter((item) => item.status !== 'purchased')
    const others = piles.filter(
      (pile) => pile.kind === 'category' && pile.id !== category?.id,
    )
    const gotPile = piles.find((pile) => pile.kind === 'got')
    return (
      <div className="stk-root" data-view="strip">
        <header className="stk-hd">
          <button type="button" className="stk-btn" onClick={back}>
            <ArrowLeftIcon size={13} aria-hidden="true" />
            Stacks
          </button>
          <h2>{tag}</h2>
          <span className="stk-mono stk-hd-meta">
            {arrange
              ? 'Arrange · drag to reorder'
              : stripPosition(focusIndex, strip)}
          </span>
          <span className="stk-hd-r">
            {arrange ? (
              <button
                type="button"
                className="stk-btn"
                data-primary
                onClick={() => void finishArrange()}
              >
                <CheckIcon size={13} aria-hidden="true" />
                Done
              </button>
            ) : (
              <>
                {category && wanted.length > 1 ? (
                  <button
                    type="button"
                    className="stk-btn"
                    onClick={() => setArrange(wanted.map((item) => item.id))}
                  >
                    <ArrowsDownUpIcon size={13} aria-hidden="true" />
                    Arrange
                  </button>
                ) : null}
                {opened?.kind === 'got' ? null : (
                  <button
                    type="button"
                    className="stk-btn"
                    data-primary
                    onClick={() => onAdd(category?.id ?? null)}
                  >
                    <PlusIcon size={13} aria-hidden="true" />
                    {category ? `Add to ${tag}` : 'Add'}
                  </button>
                )}
              </>
            )}
          </span>
        </header>
        {arrangeError ? (
          <p role="alert" className="wishlist-alert">
            {arrangeError}
          </p>
        ) : null}
        {arrange ? (
          <div className="stk-board" data-arrange>
            <Arrange
              items={wanted}
              order={arrange}
              onOrder={setArrange}
              onCancel={() => setArrange(null)}
            />
          </div>
        ) : strip.length === 0 ? (
          <div className="stk-board" data-empty>
            <div className="stk-empty-profile" data-inline>
              <p className="stk-empty-title">Nothing in {tag} yet</p>
              <p className="stk-empty-hint">
                Paste a link above to start the pile.
              </p>
            </div>
          </div>
        ) : (
          <Strip
            items={strip}
            focusIndex={focusIndex}
            onFocusIndex={setFocusIndex}
            onBack={back}
            onOpen={(item) => {
              opener.current = document.activeElement as HTMLElement | null
              setSheet({ id: item.id, mode: 'view' })
            }}
            onEdit={(item) => {
              opener.current = document.activeElement as HTMLElement | null
              setSheet({ id: item.id, mode: 'edit' })
            }}
            onGot={(item) => void markGot(item)}
            footer={
              <div className="stk-mini-row">
                {others.length > 0 ? <span>Other stacks</span> : null}
                {others.map((pile) =>
                  pile.kind === 'category' ? (
                    <MiniPile
                      key={pile.id}
                      label={pile.tag}
                      items={pile.items}
                      dropId={pile.id}
                      onOpen={() => onSelectCategory(pile.id)}
                    />
                  ) : null,
                )}
                <span className="stk-mini-spacer" />
                <MiniPile
                  label={`Got · ${gotPile ? gotPile.count : 0}`}
                  items={gotPile ? gotPile.items : []}
                  gotTarget
                  bump={gotBump}
                  onOpen={() => {
                    onSelectCategory(null)
                    setOpened({ kind: 'got' })
                  }}
                />
              </div>
            }
          />
        )}
        <DetailSheet
          item={sheetItem}
          categories={categories}
          initialMode={sheet?.mode ?? 'view'}
          onClose={() => setSheet(null)}
          onGot={(item) => {
            setSheet(null)
            void markGot(item)
          }}
          onSave={onSave}
          onDelete={(item) => {
            setSheet(null)
            onRemove(item)
          }}
          onChangeImage={(item) => {
            setSheet(null)
            onChangeImage(item)
          }}
          onCreateCategory={onCreateCategory}
        />
        <GotToast
          item={toast}
          onUndo={() => void undoGot()}
          reduced={reduced}
        />
      </div>
    )
  }

  return (
    <div className="stk-root" data-view="overview">
      <ul className="stk-grid" aria-label="Stacks">
        {piles.map((pile) => (
          <li
            key={
              pile.kind === 'category' || pile.kind === 'empty'
                ? pile.id
                : pile.kind
            }
          >
            {pile.kind === 'category' ? (
              <Pile
                variant="default"
                tag={pile.tag}
                items={pile.items}
                count={pile.count}
                total={pile.total}
                dropId={pile.id}
                dropActive={
                  drag?.overId === pile.id && drag.item.categoryId !== pile.id
                }
                dragSourceId={
                  drag?.item.categoryId === pile.id ? drag.item.id : null
                }
                onOpen={() => openPile(pile)}
                onDragItem={startDrag}
              />
            ) : pile.kind === 'empty' ? (
              <Pile
                variant="empty"
                tag={pile.tag}
                dropId={pile.id}
                dropActive={drag?.overId === pile.id}
                onOpen={() => openPile(pile)}
              />
            ) : pile.kind === 'got' ? (
              <Pile
                variant="got"
                tag="Got"
                items={pile.items}
                count={pile.count}
                caption={gotCaption}
                bump={gotBump}
                onOpen={() => openPile(pile)}
              />
            ) : (
              <Pile
                variant="default"
                tag="#unsorted"
                items={pile.items}
                count={pile.count}
                total={pile.total}
                dragSourceId={
                  drag && !drag.item.categoryId ? drag.item.id : null
                }
                onOpen={() => openPile(pile)}
                onDragItem={startDrag}
              />
            )}
          </li>
        ))}
        <li>
          <Pile variant="new" tag="New stack" onOpen={onNewCategory} />
        </li>
      </ul>
      {drag ? (
        <span
          className="stk-drag-ghost"
          aria-hidden="true"
          style={{ left: drag.x, top: drag.y }}
        >
          <span className="stk-card">
            <CardFace item={drag.item} />
          </span>
        </span>
      ) : null}
      <GotToast item={toast} onUndo={() => void undoGot()} reduced={reduced} />
    </div>
  )
}

function MiniPile({
  label,
  items,
  dropId,
  gotTarget = false,
  bump = 0,
  onOpen,
}: {
  label: string
  items: ReadonlyArray<GuestItem>
  dropId?: string
  gotTarget?: boolean
  bump?: number
  onOpen: () => void
}) {
  const reduced = useReducedMotion() ?? false
  return (
    <button
      type="button"
      className="stk-mini"
      data-drop-category={dropId}
      data-got-target={gotTarget || undefined}
      aria-label={label}
      onClick={onOpen}
    >
      <motion.span
        key={bump}
        className="stk-mini-cards"
        initial={false}
        animate={bump > 0 && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={
          reduced ? instant : { duration: t.d.standard, ease: t.ease.standard }
        }
      >
        {items
          .slice(0, PILE_DEPTH)
          .map((item, depth) => (
            <span key={item.id} className="stk-card" data-depth={depth}>
              <CardFace item={item} showStamp={false} />
            </span>
          ))
          .reverse()}
      </motion.span>
      <span className="stk-mini-label">{label}</span>
    </button>
  )
}

function GotToast({
  item,
  onUndo,
  reduced,
}: {
  item: GuestItem | null
  onUndo: () => void
  reduced: boolean
}) {
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {item ? 'Moved to Got. Undo available.' : ''}
      </p>
      <AnimatePresence>
        {item ? (
          <motion.div
            className="stk-toast"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: reduced
                ? instant
                : { duration: t.d.exit, ease: t.ease.exit },
            }}
            transition={reduced ? instant : t.spring.snappy}
          >
            <span>Moved to Got. Nice.</span>
            <button type="button" onClick={onUndo}>
              Undo
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

export function StacksSkeleton() {
  return (
    <ul className="stk-grid" aria-label="Loading stacks" aria-busy="true">
      {[0, 1, 2, 3].map((index) => (
        <li key={index}>
          <div className="stk-tile" data-variant="skeleton">
            <span className="stk-pile">
              <span className="stk-card stk-sk" />
            </span>
            <span className="stk-label">
              <span className="stk-sk stk-sk-line" />
              <span className="stk-sk stk-sk-line" data-short />
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

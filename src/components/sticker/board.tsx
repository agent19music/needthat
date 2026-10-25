import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, ReactNode } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Link } from '@tanstack/react-router'
import {
  CheckIcon,
  ClipboardTextIcon,
  KeyReturnIcon,
  LinkIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  SignOutIcon,
  SquaresFourIcon,
  StackIcon,
  StickerIcon,
  UserIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'

import { Arrange } from '#/components/stacks/arrange'
import { GotPage } from '#/components/sticker/got-page'
import { ItemPanel } from '#/components/sticker/item-panel'
import { FlyLayer, Overlay, Toast } from '#/components/sticker/overlays'
import type { Flight, ToastState } from '#/components/sticker/overlays'
import { PrintFlow } from '#/components/sticker/print-flow'
import { ShareSheet, shareUrl } from '#/components/sticker/share-sheet'
import type {
  ShareSettings,
  ShareTarget,
} from '#/components/sticker/share-sheet'
import { Sheet } from '#/components/sticker/sheet'
import { KissCutFilters, nameInitials } from '#/components/sticker/sticker'
import { burstTotalMs } from '#/components/sticker/motion'
import {
  GOT_PAGE_SIZE,
  buildSheets,
  gotCountLabel,
  pageOf,
  paginateGot,
  sheetKicker,
  sheetMeta,
} from '#/lib/sticker/sheets'
import type { SheetFill, TagSheet } from '#/lib/sticker/sheets'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

export type BoardLayout = 'grid' | 'stacks' | 'list'

export type BoardUser = {
  name: string
  username: string | null
  image: string | null
}

type Open =
  | { kind: 'item'; id: string }
  | { kind: 'got' }
  | { kind: 'print'; text: string; categoryId: string | null }
  | { kind: 'share'; key: string | null }
  | { kind: 'arrange'; key: string }

export type StickerBoardProps = {
  items: ReadonlyArray<GuestItem>
  categories: ReadonlyArray<GuestCategory>
  status: 'loading' | 'ready' | 'error'
  onRetry: () => void
  /** Signed-in owner, or null for a guest list on this device. */
  user: BoardUser | null
  origin: string
  layout: BoardLayout
  onLayout: (layout: BoardLayout) => void
  settings: ShareSettings
  onSettings: (next: ShareSettings) => void
  /** Optimistic: update the list first, persist, roll back and throw on failure. */
  onSetGot: (item: GuestItem, got: boolean) => Promise<void>
  onPrint: (item: GuestItem) => Promise<void>
  onCreateCategory: (name: string) => Promise<GuestCategory | string>
  onReorder: (ids: Array<string>) => Promise<void>
  onEdit: (item: GuestItem) => void
  onDelete: (item: GuestItem) => void
  onSearch: () => void
  onSignOut: () => void
  /** Desktop Grid / List keep the old views; they render below the tabs. */
  children?: ReactNode
}

type ToastInput = ToastState extends infer T
  ? T extends ToastState
    ? Omit<T, 'id'>
    : never
  : never

const WIDE_QUERY = '(min-width: 768px)'

function subscribeWide(callback: () => void) {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

/** 768 and up gets the desktop board; the server renders the phone layout. */
export function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  )
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function frames() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/** The whole Sticker Sheet board: desktop (≥768) and phone layouts. */
export function StickerBoard(props: StickerBoardProps) {
  const { items, categories, status, user } = props
  const wide = useWide()
  const [now, setNow] = useState(() => Date.now())
  const [tab, setTab] = useState<string | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const [gotPage, setGotPage] = useState(0)
  const [previousCount, setPreviousCount] = useState<number | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [landingId, setLandingId] = useState<string | null>(null)
  const [landedId, setLandedId] = useState<string | null>(null)
  const [printedId, setPrintedId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [newSheet, setNewSheet] = useState<string | null>(null)
  const [newSheetError, setNewSheetError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const toastId = useRef(0)
  const failed = useRef(new Set<string>())

  const sets = useMemo(
    () => buildSheets(items, categories),
    [items, categories],
  )
  const tagSheets = useMemo(
    () => [...sets.filled, ...sets.blank].sort((a, b) => a.number - b.number),
    [sets],
  )
  const sheetByCategory = useMemo(() => {
    const map = new Map<string, TagSheet>()
    tagSheets.forEach((sheet) => map.set(sheet.key, sheet))
    return map
  }, [tagSheets])
  const wantCount = items.filter((item) => item.status !== 'purchased').length
  const gotCount = sets.got.count
  const showPrice = true
  const perPage = wide ? GOT_PAGE_SIZE.desktop : GOT_PAGE_SIZE.mobile
  const selected = tab ? (sheetByCategory.get(tab) ?? null) : null

  useEffect(() => {
    document.documentElement.dataset.board = 'sticker'
    return () => {
      delete document.documentElement.dataset.board
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (tab && !sheetByCategory.has(tab)) setTab(null)
  }, [tab, sheetByCategory])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  // G marks the open sticker got (the handoff's context menu is not drawn yet).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'g' || event.metaKey || event.ctrlKey || event.altKey)
        return
      if (open?.kind !== 'item') return
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"]')
      )
        return
      const item = items.find((entry) => entry.id === open.id)
      const hero = document.querySelector<HTMLElement>('.nt-hero .nt-art')
      if (item && item.status !== 'purchased' && hero)
        void peel(item, hero.getBoundingClientRect())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function say(next: ToastInput) {
    toastId.current += 1
    setToast({ ...next, id: toastId.current })
  }

  function sheetFor(item: GuestItem): TagSheet | null {
    if (item.categoryId) {
      const sheet = sheetByCategory.get(item.categoryId)
      if (sheet) return sheet
    }
    return sets.filled.find((sheet) => sheet.categoryId === null) ?? null
  }

  async function peel(item: GuestItem, from: DOMRect) {
    if (flight || landingId) return
    failed.current.delete(item.id)
    setNow(Date.now())
    setPreviousCount(gotCount)
    setLandingId(item.id)
    setOpen(wide ? null : { kind: 'got' })
    setGotPage(0)
    const saving = props.onSetGot(item, true)
    saving.catch(() => {
      failed.current.add(item.id)
      setFlight(null)
      setLandingId(null)
      setPreviousCount(null)
      say({
        kind: 'error',
        message: "Couldn't save. Try again",
        retry: () => void retryGot(item),
      })
    })
    if (wide) {
      document
        .getElementById('nt-got-sheet')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    await frames()
    await wait(wide ? 280 : 320)
    if (failed.current.has(item.id)) return
    const target = document.querySelector<HTMLElement>(
      `[data-got-target="${CSS.escape(item.id)}"] .nt-art`,
    )
    if (!target) {
      land(item)
      return
    }
    setFlight({ item, from, to: target.getBoundingClientRect(), rotate: 0 })
  }

  async function retryGot(item: GuestItem) {
    try {
      await props.onSetGot(item, true)
      say({ kind: 'got', item })
    } catch {
      say({
        kind: 'error',
        message: "Couldn't save. Try again",
        retry: () => void retryGot(item),
      })
    }
  }

  function land(item: GuestItem) {
    setFlight(null)
    setLandingId(null)
    if (failed.current.has(item.id)) return
    setLandedId(item.id)
    if ('vibrate' in navigator) navigator.vibrate(12)
    say({ kind: 'got', item })
    window.setTimeout(() => setLandedId(null), burstTotalMs(false) + 400)
  }

  async function unpeel(item: GuestItem) {
    setToast(null)
    setPreviousCount(null)
    try {
      await props.onSetGot(item, false)
    } catch {
      say({
        kind: 'error',
        message: "Couldn't save. Try again",
        retry: () => void unpeel(item),
      })
    }
  }

  async function print(item: GuestItem) {
    await props.onPrint(item)
    setOpen(null)
    setNow(Date.now())
    setPrintedId(item.id)
    if (item.categoryId && !wide) setTab(item.categoryId)
    window.setTimeout(() => setPrintedId(null), 1600)
  }

  async function addSheet() {
    if (newSheet === null) return
    const result = await props.onCreateCategory(newSheet)
    if (typeof result === 'string') {
      setNewSheetError(result)
      return
    }
    setNewSheet(null)
    setNewSheetError(null)
    setTab(result.id)
  }

  function openItem(item: GuestItem) {
    setOpen({ kind: 'item', id: item.id })
  }

  function openGot(itemId?: string) {
    const pages = paginateGot(sets.got.items, perPage)
    setGotPage(itemId ? Math.max(0, pageOf(pages, itemId)) : 0)
    setPreviousCount(null)
    setOpen({ kind: 'got' })
  }

  function startPrint(text = '', categoryId: string | null = tab) {
    setOpen({ kind: 'print', text, categoryId })
  }

  async function copyLink(sheetId: string | null) {
    if (!user?.username) return
    try {
      await navigator.clipboard.writeText(
        shareUrl(props.origin, user.username, sheetId),
      )
      say({ kind: 'info', message: 'Link copied' })
    } catch {
      say({ kind: 'error', message: "Couldn't copy the link" })
    }
  }

  const shareTarget = (key: string | null): ShareTarget => {
    const sheet = key ? sheetByCategory.get(key) : null
    if (sheet)
      return {
        sheetId: sheet.categoryId,
        tag: sheet.tag,
        fill: sheet.color,
        stickers: sheet.stickers,
        total: sheet.total,
      }
    const all = items.filter((item) => item.status !== 'purchased')
    return {
      sheetId: null,
      tag: '#all',
      fill: 'blue',
      stickers: items,
      total: sheetMeta(all.length, null),
    }
  }

  const commonSheet = {
    now,
    showPrice,
    categories,
    allItems: items,
    printedId,
    peelable: true,
    onOpen: openItem,
    onPeel: (item: GuestItem, from: DOMRect) => void peel(item, from),
  }

  const tabs = (
    <>
      <button
        type="button"
        role="tab"
        className="nt-tab"
        data-fill="all"
        aria-selected={tab === null}
        onClick={() => setTab(null)}
      >
        #all <b>{wantCount}</b>
      </button>
      {tagSheets.map((sheet) => (
        <button
          key={sheet.key}
          type="button"
          role="tab"
          className="nt-tab"
          data-fill={sheet.stickers.length === 0 ? 'blank' : sheet.color}
          aria-selected={tab === sheet.key}
          onClick={() => setTab(sheet.key)}
        >
          {sheet.tag} <b>{sheet.wanted.length}</b>
        </button>
      ))}
      {newSheet === null ? (
        <button
          type="button"
          className="nt-tab"
          data-fill="blank"
          aria-label="New sheet"
          onClick={() => setNewSheet('')}
        >
          <PlusIcon aria-hidden="true" />
        </button>
      ) : (
        <form
          className="nt-tab"
          data-fill="blank"
          onSubmit={(event) => {
            event.preventDefault()
            void addSheet()
          }}
        >
          #
          <input
            aria-label="New sheet name"
            autoFocus
            value={newSheet}
            enterKeyHint="done"
            style={{
              width: 110,
              border: 0,
              background: 'transparent',
              font: 'inherit',
              outline: 'none',
            }}
            onChange={(event) => setNewSheet(event.target.value)}
            onBlur={() => {
              if (!newSheet.trim()) setNewSheet(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setNewSheet(null)
            }}
          />
          <button type="submit" aria-label="Add sheet">
            <CheckIcon weight="bold" aria-hidden="true" />
          </button>
        </form>
      )}
    </>
  )

  const overlays = (
    <>
      <Overlays
        {...props}
        open={open}
        setOpen={setOpen}
        now={now}
        wide={wide}
        sets={sets}
        sheetFor={sheetFor}
        perPage={perPage}
        gotPage={gotPage}
        setGotPage={setGotPage}
        previousCount={previousCount}
        landingId={landingId}
        landedId={landedId}
        onPeel={(item, from) => void peel(item, from)}
        onUnpeel={(item) => void unpeel(item)}
        onPrintItem={print}
        onSeeSheet={(key) => {
          setOpen(null)
          setTab(key)
        }}
        shareTarget={shareTarget}
        onToast={(message) => say({ kind: 'info', message })}
        topBar={
          <MobileTop
            user={user}
            onHome={() => setOpen(null)}
            onSearch={props.onSearch}
            onSignOut={props.onSignOut}
          />
        }
      />
      <FlyLayer
        flight={flight}
        onDone={() => {
          if (flight) land(flight.item)
        }}
      />
      <Toast
        toast={toast}
        onDismiss={() => setToast(null)}
        onUndo={() => {
          if (toast?.kind === 'got') void unpeel(toast.item)
        }}
      />
      {newSheetError ? (
        <p className="nt-sr" role="alert">
          {newSheetError}
        </p>
      ) : null}
    </>
  )

  if (!wide) {
    const shown = selected
      ? [selected, ...peekAfter(tagSheets, selected)]
      : sets.filled.length > 0
        ? [...sets.filled, ...sets.blank]
        : sets.blank.slice(0, 1)
    return (
      <div className="nt-root nt-mobile">
        <KissCutFilters />
        <MobileTop
          user={user}
          onSearch={props.onSearch}
          onSignOut={props.onSignOut}
        />
        <div className="nt-pr">
          <div className="nt-pr-id">
            <Avatar user={user} />
            <div style={{ minWidth: 0 }}>
              <h2>{user?.name || 'Your sheet'}</h2>
              <p>
                {user?.username ? (
                  <>
                    @{user.username} ·
                    <button
                      type="button"
                      onClick={() => setOpen({ kind: 'share', key: tab })}
                    >
                      Share
                    </button>
                  </>
                ) : user ? (
                  <Link to="/account">Choose a username</Link>
                ) : (
                  <Link to="/sign-in">Sign in</Link>
                )}
              </p>
            </div>
          </div>
          <Stats
            want={wantCount}
            got={gotCount}
            onGot={() => openGot()}
            className="nt-pr-stats"
          />
        </div>
        <div className="nt-mtabs" role="tablist" aria-label="Sheets">
          {tabs}
        </div>
        <div className="nt-msheets">
          {status === 'loading' ? (
            <Loading />
          ) : status === 'error' ? (
            <LoadError onRetry={props.onRetry} />
          ) : shown.length === 0 ? (
            <BlankSheet first onPaste={() => startPrint('', null)} />
          ) : (
            shown.map((sheet, index) =>
              sheet.stickers.length === 0 ? (
                <BlankSheet
                  key={sheet.key}
                  sheet={sheet}
                  active={index === 0 && selected !== null}
                  className={index > 0 && selected ? 'nt-peek' : undefined}
                  onPaste={() => startPrint('', sheet.categoryId)}
                />
              ) : (
                <Sheet
                  key={sheet.key}
                  {...commonSheet}
                  fill={sheet.color}
                  kicker={sheetKicker(sheet.number)}
                  title={sheet.tag}
                  meta={sheetMeta(sheet.wanted.length, sheet.total, {
                    compact: true,
                  })}
                  variant="column"
                  stickers={sheet.stickers}
                  mode="board"
                  active={index === 0 && (selected !== null || tab === null)}
                  className={index > 0 && selected ? 'nt-peek' : undefined}
                >
                  {index === 0 ? (
                    <span className="nt-sheet-hint">Peel to mark got</span>
                  ) : null}
                </Sheet>
              ),
            )
          )}
        </div>
        <button type="button" className="nt-fab" onClick={() => startPrint()}>
          <StickerIcon weight="fill" aria-hidden="true" />
          Print a sticker
        </button>
        {overlays}
      </div>
    )
  }

  const boardSheets = selected ? [selected] : sets.filled
  const blanks = selected ? [] : sets.blank
  return (
    <div className="nt-root">
      <KissCutFilters />
      <header className="nt-top">
        <Link to="/" className="nt-word">
          #needthat
        </Link>
        <div className="nt-top-right">
          <button type="button" className="nt-search" onClick={props.onSearch}>
            <MagnifyingGlassIcon aria-hidden="true" />
            <span>Search your stickers</span>
            <kbd>Ctrl K</kbd>
          </button>
          <AccountButton user={user} onSignOut={props.onSignOut} size={42} />
        </div>
      </header>
      <div className="nt-desk">
        <aside className="nt-cover-col">
          <div className="nt-cover">
            <Avatar user={user} />
            <Stats want={wantCount} got={gotCount} onGot={() => openGot()} />
            <h1>{user?.name || 'Your sheet'}</h1>
            {user?.username ? (
              <span className="nt-handle">@{user.username}</span>
            ) : null}
            <div className="nt-actions">
              {user?.username ? (
                <button
                  type="button"
                  className="nt-pill"
                  data-tone="ink"
                  onClick={() => void copyLink(selected?.categoryId ?? null)}
                >
                  <LinkIcon weight="bold" aria-hidden="true" />
                  Copy share link
                </button>
              ) : null}
              {user ? (
                <Link to="/account" className="nt-pill" data-tone="white">
                  <PencilSimpleIcon aria-hidden="true" />
                  Edit
                </Link>
              ) : (
                <Link to="/sign-in" className="nt-pill" data-tone="ink">
                  Sign in
                </Link>
              )}
            </div>
          </div>
          <div className="nt-labl">
            <span className="nt-tape" aria-hidden="true" />
            <h4>Once that cheque hits, I need…</h4>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const text = note.trim()
                setNote('')
                startPrint(text, selected?.categoryId ?? null)
              }}
            >
              <input
                aria-label="Paste a link or type a name"
                placeholder="White Nike Shox"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <button
                type="submit"
                className="nt-enter"
                aria-label="Print a sticker"
              >
                <KeyReturnIcon aria-hidden="true" />
              </button>
            </form>
            <p>
              Paste a link or type a name. It prints as a sticker on the sheet
              you pick.
            </p>
          </div>
        </aside>
        <main className="nt-board-col">
          <div className="nt-tabrow">
            <div className="nt-tabs" role="tablist" aria-label="Sheets">
              {tabs}
            </div>
            <div className="nt-tab-tools">
              <div className="nt-seg" role="group" aria-label="Layout">
                <SegButton
                  current={props.layout}
                  value="grid"
                  onLayout={props.onLayout}
                  icon={<SquaresFourIcon aria-hidden="true" />}
                >
                  Grid
                </SegButton>
                <SegButton
                  current={props.layout}
                  value="stacks"
                  onLayout={props.onLayout}
                  icon={<StackIcon weight="fill" aria-hidden="true" />}
                >
                  Stacks
                </SegButton>
                <SegButton
                  current={props.layout}
                  value="list"
                  onLayout={props.onLayout}
                  icon={<ListIcon aria-hidden="true" />}
                >
                  List
                </SegButton>
              </div>
            </div>
          </div>
          <div className="nt-board">
            {props.layout !== 'stacks' ? (
              props.children
            ) : status === 'loading' ? (
              <div className="nt-board-grid">
                <Loading wide />
              </div>
            ) : status === 'error' ? (
              <LoadError onRetry={props.onRetry} />
            ) : (
              <div className="nt-board-grid">
                {boardSheets.length === 0 && blanks.length === 0 ? (
                  <div className="nt-wide">
                    <BlankSheet first onPaste={() => startPrint('', null)} />
                  </div>
                ) : null}
                {boardSheets.map((sheet, index) => {
                  if (sheet.stickers.length === 0)
                    return (
                      <div key={sheet.key} className="nt-wide">
                        <BlankSheet
                          sheet={sheet}
                          onPaste={() => startPrint('', sheet.categoryId)}
                        />
                      </div>
                    )
                  const variant = selected
                    ? 'wall'
                    : index === 0
                      ? 'wide'
                      : 'half'
                  return (
                    <div
                      key={sheet.key}
                      className={
                        selected
                          ? 'nt-wide'
                          : index === 0
                            ? 'nt-wide'
                            : 'nt-half'
                      }
                    >
                      <Sheet
                        {...commonSheet}
                        fill={sheet.color}
                        kicker={sheetKicker(sheet.number)}
                        title={sheet.tag}
                        meta={sheetMeta(sheet.wanted.length, sheet.total)}
                        variant={variant}
                        stickers={sheet.stickers}
                        mode="board"
                        onMore={() => setTab(sheet.key)}
                      >
                        {index === 0 && !selected ? (
                          <span className="nt-sheet-hint" data-place="left">
                            Peel a sticker off to mark it got.
                          </span>
                        ) : null}
                      </Sheet>
                    </div>
                  )
                })}
                <div className="nt-gotsheet">
                  <Sheet
                    {...commonSheet}
                    id="nt-got-sheet"
                    fill="yellow"
                    kicker="THE GOT PAGE"
                    title="Got"
                    variant="got"
                    stickers={sets.got.items}
                    mode="got"
                    peelable={false}
                    newestGotId={sets.got.items[0]?.id ?? null}
                    landingId={landingId}
                    landedId={landedId}
                    onMore={() => openGot()}
                  >
                    <span className="nt-cnt" data-place="sheet">
                      {gotCountLabel(sets.got.items, now)}
                    </span>
                    <span className="nt-sheet-hint" data-place="left">
                      Peeled stickers land here, dated.
                    </span>
                  </Sheet>
                </div>
                {blanks.map((sheet) => (
                  <div key={sheet.key} className="nt-blanksheet">
                    <BlankSheet
                      sheet={sheet}
                      compact
                      onPaste={() => startPrint('', sheet.categoryId)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="nt-under">
            {newSheet === null ? (
              <button
                type="button"
                className="nt-pill"
                data-tone="white"
                onClick={() => setNewSheet('')}
              >
                <PlusIcon weight="bold" aria-hidden="true" />
                New sheet
              </button>
            ) : (
              <span />
            )}
            <p className="nt-foot">
              #needthat is a product of{' '}
              <a
                href="https://uzskicorp.agency"
                target="_blank"
                rel="noreferrer"
              >
                Uzski Corp
              </a>
            </p>
          </div>
          {newSheetError ? <p className="nt-err">{newSheetError}</p> : null}
        </main>
      </div>
      {overlays}
    </div>
  )
}

function peekAfter(sheets: ReadonlyArray<TagSheet>, selected: TagSheet) {
  const index = sheets.findIndex((sheet) => sheet.key === selected.key)
  return sheets.slice(index + 1, index + 2)
}

function SegButton({
  current,
  value,
  onLayout,
  icon,
  children,
}: {
  current: BoardLayout
  value: BoardLayout
  onLayout: (layout: BoardLayout) => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={current === value}
      onClick={() => onLayout(value)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {icon}
      {children}
    </button>
  )
}

function Stats({
  want,
  got,
  onGot,
  className,
}: {
  want: number
  got: number
  onGot: () => void
  className?: string
}) {
  const body = (
    <>
      <span className="nt-dot nt-stat nt-stat-want" data-fill="red">
        <b>{want}</b>
        <small>{want === 1 ? 'want' : 'wants'}</small>
      </span>
      <button
        type="button"
        className="nt-dot nt-stat nt-stat-got"
        data-fill="blue"
        aria-label={`${got} got. Open the Got page`}
        onClick={onGot}
      >
        <b>{got}</b>
        <small>got</small>
      </button>
    </>
  )
  return className ? <div className={className}>{body}</div> : body
}

export function Avatar({
  user,
  style,
}: {
  user: BoardUser | null
  style?: CSSProperties
}) {
  return (
    <span className="nt-av" style={style} aria-hidden="true">
      {user?.image ? (
        <img src={user.image} alt="" referrerPolicy="no-referrer" />
      ) : (
        nameInitials(user?.name || 'You')
      )}
    </span>
  )
}

function AccountButton({
  user,
  onSignOut,
  size,
}: {
  user: BoardUser | null
  onSignOut: () => void
  size: number
}) {
  if (!user)
    return (
      <Link to="/sign-in" className="nt-pill" data-tone="white">
        Sign in
      </Link>
    )
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          style={{ borderRadius: '50%' }}
        >
          <Avatar
            user={user}
            style={{
              width: size,
              height: size,
              fontSize: size * 0.34,
              borderWidth: 3,
            }}
          />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="nt-layer nt-dd" align="end" sideOffset={8}>
          <Menu.Item className="nt-dd-item" asChild>
            <Link to="/account">
              <UserIcon aria-hidden="true" />
              Account
            </Link>
          </Menu.Item>
          <Menu.Item className="nt-dd-item" onSelect={onSignOut}>
            <SignOutIcon aria-hidden="true" />
            Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

function MobileTop({
  user,
  onSearch,
  onSignOut,
  onHome,
}: {
  user: BoardUser | null
  onSearch: () => void
  onSignOut: () => void
  onHome?: () => void
}) {
  return (
    <header className="nt-mt">
      {onHome ? (
        <button
          type="button"
          className="nt-word"
          onClick={onHome}
          aria-label="Back to your sheets"
        >
          #needthat
        </button>
      ) : (
        <Link to="/" className="nt-word">
          #needthat
        </Link>
      )}
      <div className="nt-mt-right">
        <button
          type="button"
          className="nt-ib"
          aria-label="Search your stickers"
          onClick={onSearch}
        >
          <MagnifyingGlassIcon aria-hidden="true" />
        </button>
        <AccountButton user={user} onSignOut={onSignOut} size={44} />
      </div>
    </header>
  )
}

/* Dashed slots from the 390 blank-sheet frame, as fractions of sheet width. */
const BLANK_SLOTS: ReadonlyArray<CSSProperties> = [
  {
    left: '8%',
    top: '35.5cqw',
    width: '42.5%',
    height: '33cqw',
    transform: 'rotate(-3deg)',
  },
  {
    left: '55%',
    top: '33cqw',
    width: '37%',
    height: '37cqw',
    borderRadius: '50%',
  },
  {
    left: '11%',
    top: '75cqw',
    width: '33%',
    height: '9.2cqw',
    borderRadius: 999,
  },
  {
    left: '51%',
    top: '77.5cqw',
    width: '40%',
    height: '28.5cqw',
    transform: 'rotate(3deg)',
  },
]

/* 1440 frame: the small blank sheet has three slots and the copy at the foot. */
const COMPACT_SLOTS: ReadonlyArray<CSSProperties> = [
  { left: '8.2%', top: '7.5cqw', width: '39%', height: '31cqw' },
  {
    left: '52%',
    top: '11cqw',
    width: '40%',
    height: '40cqw',
    borderRadius: '50%',
  },
  {
    left: '10.6%',
    top: '44cqw',
    width: '34%',
    height: '9cqw',
    borderRadius: 999,
  },
]

export function BlankSheet({
  sheet,
  first,
  compact,
  active,
  className,
  onPaste,
}: {
  sheet?: TagSheet
  first?: boolean
  compact?: boolean
  active?: boolean
  className?: string
  onPaste: () => void
}) {
  const tag = sheet?.tag ?? '#all'
  const fill: SheetFill = 'blank'
  return (
    <Sheet
      fill={fill}
      kicker={compact ? null : sheetKicker(sheet?.number ?? 1)}
      title={compact ? '' : tag}
      meta={compact ? null : '0 stickers'}
      variant="column"
      stickers={[]}
      mode="board"
      now={0}
      showPrice={false}
      active={active}
      className={className}
      style={{ aspectRatio: compact ? '1' : '1 / 1.56' }}
    >
      {(compact ? COMPACT_SLOTS : BLANK_SLOTS).map((style, index) => (
        <span
          key={index}
          className="nt-eslot"
          style={style}
          aria-hidden="true"
        />
      ))}
      <div
        className="nt-blank-copy"
        style={{ top: compact ? '62cqw' : '116cqw' }}
      >
        <b>{first ? 'This is your sheet' : `${tag} is a blank sheet`}</b>
        <p>Paste a link to print the first sticker.</p>
        {compact ? null : (
          <button
            type="button"
            className="nt-pill"
            data-tone="ink"
            onClick={onPaste}
          >
            <ClipboardTextIcon aria-hidden="true" />
            Paste a link
          </button>
        )}
      </div>
    </Sheet>
  )
}

function Loading({ wide }: { wide?: boolean }) {
  return (
    <div
      className={['nt-loading', wide ? 'nt-wide' : null]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label="Loading your sheets"
      style={{
        aspectRatio: wide ? '876 / 320' : '1 / 1.3',
        containerType: 'inline-size',
      }}
    >
      {BLANK_SLOTS.slice(0, wide ? 3 : 4).map((style, index) => (
        <span
          key={index}
          className="nt-eslot"
          style={style}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="nt-error" role="alert">
      <b>Couldn't load your sheets</b>
      <button
        type="button"
        className="nt-pill"
        data-tone="ink"
        onClick={onRetry}
      >
        <WarningCircleIcon aria-hidden="true" />
        Retry
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Overlays(
  props: StickerBoardProps & {
    open: Open | null
    setOpen: (open: Open | null) => void
    now: number
    wide: boolean
    sets: ReturnType<typeof buildSheets>
    sheetFor: (item: GuestItem) => TagSheet | null
    perPage: number
    gotPage: number
    setGotPage: (page: number) => void
    previousCount: number | null
    landingId: string | null
    landedId: string | null
    onPeel: (item: GuestItem, from: DOMRect) => void
    onUnpeel: (item: GuestItem) => void
    onPrintItem: (item: GuestItem) => Promise<void>
    onSeeSheet: (key: string) => void
    shareTarget: (key: string | null) => ShareTarget
    onToast: (message: string) => void
    topBar: ReactNode
  },
) {
  const { open, setOpen, items } = props
  const close = () => setOpen(null)
  const item =
    open?.kind === 'item' ? items.find((entry) => entry.id === open.id) : null
  const sheet = item ? props.sheetFor(item) : null
  const arrangeSheet =
    open?.kind === 'arrange'
      ? [...props.sets.filled].find((entry) => entry.key === open.key)
      : null
  return (
    <>
      <Overlay
        open={Boolean(item)}
        onClose={close}
        kind="panel"
        title={item?.title ?? 'Sticker'}
        fill={sheet?.color}
      >
        {item ? (
          <ItemPanel
            item={item}
            sheet={{
              fill: sheet?.color ?? 'blue',
              tag: sheet?.tag ?? '#all',
              number: sheet?.number ?? 1,
              stickers: sheet?.stickers ?? [item],
            }}
            now={props.now}
            showPrice
            onClose={close}
            onPeel={props.onPeel}
            onUnpeel={(entry) => {
              props.onUnpeel(entry)
            }}
            onEdit={(entry) => {
              close()
              props.onEdit(entry)
            }}
            onDelete={(entry) => {
              close()
              props.onDelete(entry)
            }}
            onArrange={
              sheet
                ? () => setOpen({ kind: 'arrange', key: sheet.key })
                : undefined
            }
            onOpen={(entry) => setOpen({ kind: 'item', id: entry.id })}
            onSeeSheet={() => (sheet ? props.onSeeSheet(sheet.key) : close())}
          />
        ) : null}
      </Overlay>

      <Overlay
        open={open?.kind === 'got'}
        onClose={close}
        kind="panel"
        title="Got page"
      >
        <GotPage
          items={items}
          categories={props.categories}
          now={props.now}
          showPrice
          perPage={props.perPage}
          page={props.gotPage}
          onPage={props.setGotPage}
          previousCount={props.previousCount}
          landingId={props.landingId}
          landedId={props.landedId}
          onOpen={(entry) => setOpen({ kind: 'item', id: entry.id })}
          top={props.wide ? null : props.topBar}
        />
      </Overlay>

      <Overlay
        open={open?.kind === 'print'}
        onClose={close}
        kind="panel"
        title="Print a sticker"
      >
        {open?.kind === 'print' ? (
          <PrintFlow
            initial={open.text}
            categories={props.categories}
            categoryId={open.categoryId}
            onClose={close}
            onPrint={props.onPrintItem}
            onCreateCategory={props.onCreateCategory}
          />
        ) : null}
      </Overlay>

      <Overlay
        open={open?.kind === 'share'}
        onClose={close}
        kind="panel"
        title="Share sheet"
      >
        {open?.kind === 'share' && props.user?.username ? (
          <ShareSheet
            target={props.shareTarget(open.key)}
            username={props.user.username}
            name={props.user.name}
            origin={props.origin}
            now={props.now}
            settings={props.settings}
            onSettings={props.onSettings}
            onClose={close}
            onToast={props.onToast}
          />
        ) : null}
      </Overlay>

      <Overlay
        open={Boolean(arrangeSheet)}
        onClose={close}
        kind="panel"
        title="Arrange sheet"
      >
        {arrangeSheet ? (
          <Arrange
            items={arrangeSheet.wanted}
            order={arrangeSheet.wanted.map((entry) => entry.id)}
            onOrder={(order) => {
              close()
              void props.onReorder(order)
            }}
            onCancel={close}
          />
        ) : null}
      </Overlay>
    </>
  )
}

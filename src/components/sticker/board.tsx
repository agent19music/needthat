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
  ArrowsDownUpIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardTextIcon,
  ClockIcon,
  CurrencyDollarIcon,
  HandPointingIcon,
  InfoIcon,
  LinkIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  RulerIcon,
  SignOutIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SquaresFourIcon,
  StackIcon,
  UserCircleIcon,
  LockSimpleIcon,
  DeviceMobileIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'

import { Arrange } from '#/components/stacks/arrange'
import { GotPage } from '#/components/sticker/got-page'
import { ItemPanel } from '#/components/sticker/item-panel'
import { FlyLayer, Overlay, Toast } from '#/components/sticker/overlays'
import type { Flight, ToastState } from '#/components/sticker/overlays'
import { PrintFlow } from '#/components/sticker/print-flow'
import { PriceSheet } from '#/components/sticker/price-sheet'
import { ShareSheet } from '#/components/sticker/share-sheet'
import type {
  ShareSettings,
  ShareTarget,
} from '#/components/sticker/share-sheet'
import { Sheet } from '#/components/sticker/sheet'
import {
  CoverNote,
  KissCutFilters,
  nameInitials,
} from '#/components/sticker/sticker'
import { burstTotalMs } from '#/components/sticker/motion'
import {
  GOT_PAGE_SIZE,
  buildSheets,
  categoryTag,
  formatTotal,
  gotCountLabel,
  isSortMode,
  newBadgeIds,
  pageOf,
  paginateGot,
  sheetKicker,
  sheetMeta,
} from '#/lib/sticker/sheets'
import type { SheetFill, SortMode, TagSheet } from '#/lib/sticker/sheets'
import { useOpened } from '#/lib/sticker/opened'
import type { LayoutKind } from '#/lib/sticker/layout'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'
import {
  shareFor,
  shareForTarget,
  sheetKey,
  wasSharing,
} from '#/lib/wishlist/sheet-share'
import type { OwnerClaim, SheetShare } from '#/lib/wishlist/types'
import { UNSORTED_SHEET } from '#/lib/wishlist/types'
import { ownerCaption, ownerClaimLine } from '#/lib/sticker/claim-copy'

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
  | {
      kind: 'share'
      key: string | null
      /** r7 C102: the sheet "Share all sheets" came from. */
      from?: string
    }
  | { kind: 'arrange'; key: string }
  | { kind: 'price'; id: string }

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
  /** r7 (Q3): share switches per sheet, by category id or UNSORTED_SHEET. */
  sheetShares: Readonly<Record<string, SheetShare>>
  /** Writes `next` to every sheet in `keys` (one sheet, or all for #all). */
  onShareSettings: (keys: Array<string>, next: ShareSettings) => void
  /** r8: writes exactly `patch` to `keys`. Stop sharing and its Undo. */
  onSharePatch?: (keys: Array<string>, patch: Partial<SheetShare>) => void
  /** r7 (Q1): who claimed each wanted sticker. Owner only. */
  claims?: Readonly<Record<string, OwnerClaim>>
  /** r7 (Q4): cover note, FOR line (C12) and bio (C11). */
  profile?: { bio: string; forLine: string }
  onEditProfile?: () => void
  /** Optimistic: update the list first, persist, roll back and throw on failure. */
  onSetGot: (item: GuestItem, got: boolean) => Promise<void>
  onPrint: (item: GuestItem) => Promise<void>
  onCreateCategory: (name: string) => Promise<GuestCategory | string>
  onReorder: (ids: Array<string>) => Promise<void>
  onEdit: (item: GuestItem) => void
  onDelete: (item: GuestItem) => void
  /**
   * r3 overflow (Move to sheet, Edit price): saves one changed item.
   * Optimistic like onSetGot: roll back and throw on failure.
   */
  onUpdate?: (item: GuestItem) => Promise<void>
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

const BAND_QUERY = '(min-width: 768px) and (max-width: 1199px)'

function subscribeBand(callback: () => void) {
  const query = window.matchMedia(BAND_QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

/** r3 B1·07: the 768–1199 band (two-up sheets, Got full width). */
export function useBand() {
  return useSyncExternalStore(
    subscribeBand,
    () => window.matchMedia(BAND_QUERY).matches,
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

/** "Got" is a tab key of its own (r2 B1·08). Sheet keys are ids or "#name". */
const GOT_TAB = 'got'

/**
 * r2 §5 sort: global, persisted per user. Kept in localStorage (per user,
 * per device) because a server setting needs a migration; flagged.
 */
const SORT_KEY = 'nt-sort-v1'

function readSort(owner: string): SortMode {
  try {
    const raw = localStorage.getItem(`${SORT_KEY}:${owner}`)
    return isSortMode(raw) ? raw : 'priority'
  } catch {
    return 'priority'
  }
}

function useSort(owner: string) {
  const [sort, setSort] = useState<SortMode>('priority')
  useEffect(() => setSort(readSort(owner)), [owner])
  return [
    sort,
    (next: SortMode) => {
      setSort(next)
      try {
        localStorage.setItem(`${SORT_KEY}:${owner}`, next)
      } catch {
        // Private mode: this session only.
      }
    },
  ] as const
}

/** Option labels from the ADDENDUM §5 list. */
export const SORT_OPTIONS: ReadonlyArray<{
  value: SortMode
  label: string
  icon: ReactNode
}> = [
  {
    value: 'priority',
    label: 'Priority',
    icon: <ArrowsDownUpIcon aria-hidden="true" />,
  },
  {
    value: 'newest',
    label: 'Newest first',
    icon: <ClockIcon aria-hidden="true" />,
  },
  {
    value: 'price-desc',
    label: 'Price: high to low',
    icon: <SortDescendingIcon aria-hidden="true" />,
  },
  {
    value: 'price-asc',
    label: 'Price: low to high',
    icon: <SortAscendingIcon aria-hidden="true" />,
  },
]

/** C60 to C63: the guest cover. */
const GUEST_TITLE = 'Your stickers'
const GUEST_LINE = 'Saved on this device only'
const GUEST_SIGN_IN = 'Sign in to save them'
const GUEST_SHARING = 'Sharing needs an account'

/** C29 / C35. */
const SORT_TITLE = 'Sort stickers'
const SORT_NOTE = 'Applies to all your sheets'

export function sortLabel(mode: SortMode) {
  return (
    SORT_OPTIONS.find((option) => option.value === mode)?.label ?? 'Priority'
  )
}

/** #unsorted takes paper-2 + hairline (B1·05); tags keep their colour. */
export function fillOf(sheet: TagSheet): SheetFill {
  return sheet.unsorted ? 'paper' : sheet.color
}

/**
 * r2 #15 / B1·06: first sheet full width (876×320), then two-up halves.
 * An odd sheet out goes full width. Got (560×292) shares its row with the
 * #unsorted tile (292); blank sheets and a spare #unsorted are tiles.
 */
export type DeskCell = { sheet: TagSheet | 'got'; kind: LayoutKind }

export function deskRows(
  filled: ReadonlyArray<TagSheet>,
  blank: ReadonlyArray<TagSheet>,
  hasGot: boolean,
  band = false,
): Array<Array<DeskCell>> {
  const named = filled.filter((sheet) => !sheet.unsorted)
  const unsorted = filled.find((sheet) => sheet.unsorted) ?? null
  const rows: Array<Array<DeskCell>> = []
  // B1·07: in the band every sheet (#unsorted too) is two-up; ≥1200 the first is wide.
  const paired = band
    ? [...named, ...(unsorted ? [unsorted] : [])]
    : named.slice(1)
  if (!band && named[0]) rows.push([{ sheet: named[0], kind: 'wide' }])
  for (let index = 0; index + 1 < paired.length; index += 2)
    rows.push([
      { sheet: paired[index], kind: 'half' },
      { sheet: paired[index + 1], kind: 'half' },
    ])
  if (paired.length % 2 === 1)
    rows.push([{ sheet: paired[paired.length - 1], kind: 'wide' }])
  const tiles: Array<TagSheet> = [
    ...(!band && unsorted ? [unsorted] : []),
    ...blank,
  ]
  if (hasGot && band) rows.push([{ sheet: 'got', kind: 'got-wide' }])
  if (hasGot && !band) {
    const partner = tiles.shift()
    rows.push([
      { sheet: 'got', kind: 'got-row' },
      ...(partner ? [{ sheet: partner, kind: 'tile' as const }] : []),
    ])
  }
  for (let index = 0; index < tiles.length; index += 3)
    rows.push(
      tiles
        .slice(index, index + 3)
        .map((sheet) => ({ sheet, kind: 'tile' as const })),
    )
  return rows
}

/** The whole Sticker Sheet board: desktop (≥768) and phone layouts. */
export function StickerBoard(props: StickerBoardProps) {
  const { items, categories, status, user } = props
  const wide = useWide()
  const band = useBand()
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
  const [sortOpen, setSortOpen] = useState(false)
  const toastId = useRef(0)
  const failed = useRef(new Set<string>())
  const returnScroll = useRef<number | null>(null)
  const [sort, setSort] = useSort(
    user?.username ?? (user ? user.name : 'guest'),
  )
  const opened = useOpened()

  const sets = useMemo(
    () => buildSheets(items, categories, sort),
    [items, categories, sort],
  )
  // #unsorted is always last before Got (B1·05).
  const tagSheets = useMemo(
    () =>
      [...sets.filled, ...sets.blank].sort(
        (a, b) =>
          Number(a.unsorted) - Number(b.unsorted) || a.number - b.number,
      ),
    [sets],
  )
  const sheetByCategory = useMemo(() => {
    const map = new Map<string, TagSheet>()
    tagSheets.forEach((sheet) => map.set(sheet.key, sheet))
    return map
  }, [tagSheets])
  const wanted = items.filter((item) => item.status !== 'purchased')
  const wantCount = wanted.length
  const gotCount = sets.got.count
  // r2 #22: counts keep the pre-peel value until 120ms after the landing.
  const shownGot = previousCount ?? gotCount
  const showPrice = true
  const perPage = wide ? GOT_PAGE_SIZE.desktop : GOT_PAGE_SIZE.mobile
  const selected =
    tab && tab !== GOT_TAB ? (sheetByCategory.get(tab) ?? null) : null
  // r2 §5 / B4·03: sort and layout switch disabled until 2+ items.
  const fewItems = items.length < 2

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
    if (tab === GOT_TAB ? gotCount === 0 : tab && !sheetByCategory.has(tab))
      setTab(null)
  }, [tab, sheetByCategory, gotCount])

  // B1·09: the Got toast stays 5s.
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 5000)
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
    // B1·09: after a peel Got opens full screen; X returns with scroll kept.
    if (!wide) returnScroll.current = window.scrollY
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
    // r2 #22: label and count update 120ms after the sticker lands.
    window.setTimeout(() => setPreviousCount(null), 120)
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

  async function update(item: GuestItem) {
    if (!props.onUpdate) return
    try {
      await props.onUpdate({ ...item, updatedAt: Date.now() })
    } catch {
      say({
        kind: 'error',
        message: "Couldn't save. Try again",
        retry: () => void update(item),
      })
    }
  }

  async function copyLink(item: GuestItem) {
    if (!item.sourceUrl) return
    try {
      await navigator.clipboard.writeText(item.sourceUrl)
      say({ kind: 'info', message: 'Link copied' })
    } catch {
      // Clipboard blocked (permissions, insecure origin): nothing to undo.
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
    returnScroll.current = window.scrollY
    setOpen({ kind: 'got' })
  }

  function closeOverlay() {
    const wasGot = open?.kind === 'got'
    setOpen(null)
    if (wasGot && returnScroll.current !== null) {
      const y = returnScroll.current
      returnScroll.current = null
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
  }

  function startPrint(text = '', categoryId: string | null = tab) {
    setOpen({ kind: 'print', text, categoryId })
  }

  const allShareKeys = useMemo(
    () => [UNSORTED_SHEET, ...categories.map((category) => category.id)],
    [categories],
  )
  const shareTarget = (key: string | null): ShareTarget => {
    const sheet = key ? sheetByCategory.get(key) : null
    if (sheet) {
      const settings = shareFor(props.sheetShares, sheet.categoryId)
      return {
        // r7: #unsorted links to its own sheet, not the whole list.
        sheetId: sheet.categoryId ?? (sheet.unsorted ? 'unsorted' : null),
        keys: [sheetKey(sheet.categoryId)],
        tag: sheet.tag,
        fill: sheet.color,
        stickers: sheet.stickers,
        total: settings.showPrices ? sheet.total : null,
      }
    }
    const all = items.filter((item) => item.status !== 'purchased')
    const settings = shareForTarget(props.sheetShares, allShareKeys)
    return {
      sheetId: null,
      keys: allShareKeys,
      tag: '#all',
      fill: 'blue',
      stickers: items,
      total: settings.showPrices ? formatTotal(all) : null,
    }
  }
  /** C14: count only on sheets with Show prices off (Q3). */
  const pricesOn = (categoryId: string | null) =>
    shareFor(props.sheetShares, categoryId).showPrices
  /** r7 (Q1, C104): the owner's caption names the claimer. */
  const ownerClaim = (item: GuestItem) => {
    const claim = props.claims?.[item.id]
    return claim && item.status !== 'purchased'
      ? { claimed: true, mine: false, caption: ownerCaption(claim.name) }
      : { claimed: false, mine: false }
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
    claimOf: ownerClaim,
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
          data-fill={
            sheet.stickers.length === 0
              ? 'blank'
              : sheet.unsorted
                ? 'paper'
                : sheet.color
          }
          aria-selected={tab === sheet.key}
          onClick={() => setTab(sheet.key)}
        >
          {sheet.tag} <b>{sheet.wanted.length}</b>
        </button>
      ))}
      {/* r2 B1·08 / #34: Got is the last tab, from the first peel on. */}
      {gotCount > 0 ? (
        <button
          type="button"
          role="tab"
          className="nt-tab"
          data-fill="yellow"
          aria-selected={tab === GOT_TAB}
          onClick={() => (wide ? openGot() : setTab(GOT_TAB))}
        >
          <CheckCircleIcon
            weight="fill"
            aria-hidden="true"
            className="nt-tab-check"
          />
          Got <b>{shownGot}</b>
        </button>
      ) : null}
      {newSheet === null ? (
        <button
          type="button"
          className="nt-tab nt-tab-add"
          data-fill="blank"
          aria-label="New sheet"
          onClick={() => setNewSheet('')}
        >
          <PlusIcon aria-hidden="true" />
        </button>
      ) : (
        <form
          className="nt-tab nt-tab-new"
          data-fill="blank"
          data-invalid={newSheetError ? 'true' : undefined}
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
            maxLength={20}
            enterKeyHint="done"
            aria-invalid={newSheetError ? true : undefined}
            onChange={(event) => {
              setNewSheetError(null)
              setNewSheet(event.target.value.toLowerCase())
            }}
            onBlur={() => {
              if (!newSheet.trim()) setNewSheet(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setNewSheet(null)
                setNewSheetError(null)
              }
            }}
          />
          <button type="submit" aria-label="Add sheet">
            <CheckIcon weight="bold" aria-hidden="true" />
          </button>
        </form>
      )}
    </>
  )

  const sortControl = (
    <SortControl
      wide={wide}
      value={sort}
      disabled={fewItems}
      open={sortOpen}
      onOpen={setSortOpen}
      onChange={(next) => {
        setSort(next)
        setSortOpen(false)
      }}
    />
  )

  const seg = (
    <div
      className="nt-seg"
      role="group"
      aria-label="Layout"
      data-disabled={fewItems ? 'true' : undefined}
    >
      <SegButton
        current={props.layout}
        value="grid"
        disabled={fewItems}
        onLayout={props.onLayout}
        icon={<SquaresFourIcon aria-hidden="true" />}
      >
        Grid
      </SegButton>
      <SegButton
        current={props.layout}
        value="stacks"
        disabled={fewItems}
        onLayout={props.onLayout}
        icon={<StackIcon weight="fill" aria-hidden="true" />}
      >
        Stacks
      </SegButton>
      <SegButton
        current={props.layout}
        value="list"
        disabled={fewItems}
        onLayout={props.onLayout}
        icon={<ListIcon aria-hidden="true" />}
      >
        List
      </SegButton>
    </div>
  )

  const newFor = (sheet: TagSheet) => newBadgeIds(sheet.stickers, now, opened)

  const overlays = (
    <>
      <Overlays
        {...props}
        open={open}
        setOpen={(next) => (next === null ? closeOverlay() : setOpen(next))}
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
        onUpdateItem={props.onUpdate ? (item) => void update(item) : undefined}
        onCopyLink={(item) => void copyLink(item)}
        onSeeSheet={(key) => {
          setOpen(null)
          setTab(key)
        }}
        shareTarget={shareTarget}
        claimLine={(item) => {
          const claim = props.claims?.[item.id]
          return claim && item.status !== 'purchased'
            ? ownerClaimLine(claim.name, claim.at, now)
            : null
        }}
        onToast={(message, undo) =>
          say({
            kind: 'info',
            message,
            undo: undo
              ? () => {
                  setToast(null)
                  undo()
                }
              : undefined,
          })
        }
        topBar={
          <MobileTop
            user={user}
            currency={pricedCurrency(items)}
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

  const hasItems = items.length > 0
  const pendingGot = landingId ?? (previousCount !== null ? landedId : null)
  const countedGot = pendingGot
    ? sets.got.items.filter((item) => item.id !== pendingGot)
    : sets.got.items
  const gotSheetProps = {
    ...commonSheet,
    fill: 'yellow' as const,
    kicker: 'GOT PAGE',
    title: 'Got',
    meta: sheetMeta(countedGot.length, formatTotal(countedGot)),
    metaPill: countedGot.length > 0 ? gotCountLabel(countedGot, now) : null,
    stickers: sets.got.items,
    mode: 'got' as const,
    peelable: false,
    landingId,
    landedId,
  }

  if (!wide) {
    const showGot = tab === GOT_TAB
    const shown = showGot
      ? []
      : selected
        ? [selected, ...peekAfter(tagSheets, selected)]
        : sets.filled.length > 0
          ? [...sets.filled, ...sets.blank]
          : sets.blank.slice(0, 1)
    // r2 #33: no FAB while the account has no stickers.
    const fab = hasItems
    return (
      <div className="nt-root nt-mobile">
        <KissCutFilters />
        <MobileTop
          user={user}
          currency={pricedCurrency(items)}
          onSearch={props.onSearch}
          onSignOut={props.onSignOut}
        />
        <div className="nt-pr">
          <div className="nt-pr-id">
            <Avatar user={user} />
            <div style={{ minWidth: 0 }}>
              <h2>{user ? user.name || 'Your sheet' : GUEST_TITLE}</h2>
              <p>
                {user?.username ? (
                  <>
                    @{user.username} ·
                    <button
                      type="button"
                      onClick={() =>
                        setOpen({ kind: 'share', key: selected?.key ?? null })
                      }
                    >
                      <LinkIcon aria-hidden="true" />
                      Share
                    </button>
                  </>
                ) : user ? (
                  <Link to="/account">Choose a username</Link>
                ) : (
                  <span className="nt-guest-line">
                    <DeviceMobileIcon aria-hidden="true" />
                    {GUEST_LINE}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Stats
            want={wantCount}
            got={shownGot}
            onGot={() => openGot()}
            className="nt-pr-stats"
          />
        </div>
        <div className="nt-mtools">
          {sortControl}
          {seg}
        </div>
        <div className="nt-mtabs" role="tablist" aria-label="Sheets">
          {tabs}
        </div>
        <div className="nt-msheets">
          {status === 'loading' ? (
            <Loading />
          ) : status === 'error' ? (
            <LoadError onRetry={props.onRetry} />
          ) : showGot ? (
            <Sheet
              {...gotSheetProps}
              id="nt-got-sheet"
              variant="got-column"
              hint={false}
              fab={fab}
              active
            />
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
                  fill={fillOf(sheet)}
                  kicker={sheetKicker(sheet.number)}
                  title={sheet.tag}
                  meta={sheetMeta(
                    sheet.wanted.length,
                    pricesOn(sheet.categoryId) ? sheet.total : null,
                  )}
                  variant="column"
                  stickers={sheet.stickers}
                  mode="board"
                  newIds={newFor(sheet)}
                  hint={index === 0}
                  fab={fab && index === shown.length - 1}
                  active={index === 0 && (selected !== null || tab === null)}
                  className={index > 0 && selected ? 'nt-peek' : undefined}
                >
                  {index === 0 && sheet.wanted.length > 0 ? (
                    <span className="nt-sheet-hint">
                      <HandPointingIcon aria-hidden="true" />
                      Peel to mark got
                    </span>
                  ) : null}
                </Sheet>
              ),
            )
          )}
        </div>
        {fab ? (
          <button type="button" className="nt-fab" onClick={() => startPrint()}>
            <PlusIcon weight="bold" aria-hidden="true" />
            Print a sticker
          </button>
        ) : null}
        {overlays}
      </div>
    )
  }

  const rows = selected
    ? [[{ sheet: selected, kind: 'wall' as const }]]
    : deskRows(sets.filled, sets.blank, gotCount > 0, band)
  const empty = status === 'ready' && !hasItems && !selected
  return (
    <div className="nt-root">
      <KissCutFilters />
      <header className="nt-top">
        <Link to="/" className="nt-word">
          #needthat
        </Link>
        <div className="nt-top-right">
          <button
            type="button"
            className="nt-search"
            onClick={props.onSearch}
            aria-label="Search your stickers"
          >
            <MagnifyingGlassIcon aria-hidden="true" />
            {/* B1·07: the band's 220 pill reads "Search stickers"; an icon below 1024. */}
            <span className="nt-search-long">Search your stickers</span>
            <span className="nt-search-short">Search stickers</span>
            <kbd>Ctrl K</kbd>
          </button>
          {sortControl}
          {seg}
          {/* B4·03: the top-bar Print pill hides while the account is empty. */}
          {hasItems ? (
            <button
              type="button"
              className="nt-pill"
              data-tone="yellow"
              onClick={() => startPrint()}
            >
              <PlusIcon weight="bold" aria-hidden="true" />
              Print a sticker
            </button>
          ) : null}
          <AccountButton
            user={user}
            onSignOut={props.onSignOut}
            size={42}
            currency={pricedCurrency(items)}
          />
        </div>
      </header>
      <div className="nt-desk">
        <aside className="nt-cover-col">
          <div className="nt-cover">
            <Avatar user={user} />
            <div className="nt-cover-id">
              <h1>{user ? user.name || 'Your sheet' : GUEST_TITLE}</h1>
              {user?.username ? (
                <span className="nt-handle">@{user.username}</span>
              ) : null}
              {user ? null : <p className="nt-guest-line">{GUEST_LINE}</p>}
            </div>
            <CoverStats
              want={wantCount}
              got={shownGot}
              total={formatTotal(wanted)}
              onGot={() => openGot()}
            />
            {user ? (
              <CoverNote
                bio={props.profile?.bio ?? ''}
                forLine={props.profile?.forLine ?? ''}
                prompt={<Link to="/account">Add a short bio</Link>}
              />
            ) : null}
            <div className="nt-actions">
              {user?.username ? (
                <button
                  type="button"
                  className="nt-pill"
                  data-tone="ink"
                  onClick={() =>
                    setOpen({ kind: 'share', key: selected?.key ?? null })
                  }
                >
                  <LinkIcon weight="bold" aria-hidden="true" />
                  Share
                </button>
              ) : null}
              {user ? (
                <Link to="/account" className="nt-pill" data-tone="white">
                  <PencilSimpleIcon aria-hidden="true" />
                  Edit
                </Link>
              ) : (
                <>
                  <Link
                    to="/sign-in"
                    className="nt-pill nt-guest-cta"
                    data-tone="ink"
                  >
                    <UserCircleIcon aria-hidden="true" />
                    {GUEST_SIGN_IN}
                  </Link>
                  <span
                    className="nt-pill nt-guest-locked"
                    aria-disabled="true"
                  >
                    <LockSimpleIcon aria-hidden="true" />
                    {GUEST_SHARING}
                  </span>
                </>
              )}
            </div>
          </div>
        </aside>
        <main className="nt-board-col">
          <div className="nt-tabrow">
            <div className="nt-tabs" role="tablist" aria-label="Sheets">
              {tabs}
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
            ) : empty ? (
              <EmptyDesk onPrint={() => startPrint('', null)} />
            ) : (
              <div className="nt-board-grid">
                {rows.map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="nt-row"
                    data-row={row.map((cell) => cell.kind).join(' ')}
                  >
                    {row.map((cell) => {
                      if (cell.sheet === 'got')
                        return (
                          <div
                            key="got"
                            className="nt-cell"
                            data-kind={cell.kind}
                          >
                            <Sheet
                              {...gotSheetProps}
                              id="nt-got-sheet"
                              variant={cell.kind}
                              onMore={() => openGot()}
                            />
                          </div>
                        )
                      const sheet = cell.sheet
                      return (
                        <div
                          key={sheet.key}
                          className="nt-cell"
                          data-kind={cell.kind}
                        >
                          {sheet.stickers.length === 0 ? (
                            <BlankSheet
                              sheet={sheet}
                              compact
                              onPaste={() => startPrint('', sheet.categoryId)}
                            />
                          ) : (
                            <Sheet
                              {...commonSheet}
                              fill={fillOf(sheet)}
                              kicker={sheetKicker(sheet.number)}
                              title={sheet.tag}
                              meta={sheetMeta(
                                sheet.wanted.length,
                                pricesOn(sheet.categoryId) ? sheet.total : null,
                              )}
                              variant={cell.kind}
                              stickers={sheet.stickers}
                              mode="board"
                              newIds={newFor(sheet)}
                              onMore={() => setTab(sheet.key)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="nt-under">
            <span />
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
  disabled,
}: {
  current: BoardLayout
  value: BoardLayout
  onLayout: (layout: BoardLayout) => void
  icon: ReactNode
  children: ReactNode
  disabled?: boolean
}) {
  // B1·01 / B1·06: icon-only segments; the label is for screen readers.
  return (
    <button
      type="button"
      aria-pressed={current === value}
      aria-label={String(children)}
      disabled={disabled}
      onClick={() => onLayout(value)}
    >
      {icon}
    </button>
  )
}

/** r2 B1·02 (390 bottom sheet) / B1·03 (1440 popover 248w). */
function SortControl({
  wide,
  value,
  disabled,
  open,
  onOpen,
  onChange,
}: {
  wide: boolean
  value: SortMode
  disabled: boolean
  open: boolean
  onOpen: (open: boolean) => void
  onChange: (value: SortMode) => void
}) {
  const chip = (
    <button
      type="button"
      className="nt-sort"
      disabled={disabled}
      aria-haspopup={wide ? 'menu' : 'dialog'}
      aria-label={`Sort: ${sortLabel(value)}`}
      onClick={wide ? undefined : () => onOpen(true)}
    >
      <ArrowsDownUpIcon aria-hidden="true" />
      <span>{sortLabel(value)}</span>
      <CaretDownIcon aria-hidden="true" />
    </button>
  )
  const options = SORT_OPTIONS.map((option) => (
    <SortRow
      key={option.value}
      option={option}
      checked={option.value === value}
      wide={wide}
      onChange={onChange}
    />
  ))
  if (wide)
    return (
      <Menu.Root modal={false} open={open} onOpenChange={onOpen}>
        <Menu.Trigger asChild>{chip}</Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            className="nt-layer nt-dd nt-sortmenu"
            align="center"
            sideOffset={8}
          >
            <Menu.Label className="nt-sort-label">{SORT_TITLE}</Menu.Label>
            <Menu.RadioGroup
              value={value}
              onValueChange={(next) => {
                if (isSortMode(next)) onChange(next)
              }}
            >
              {options}
            </Menu.RadioGroup>
            <Menu.Separator className="nt-dd-sep" />
            <div className="nt-sort-note">
              <InfoIcon aria-hidden="true" />
              {SORT_NOTE}
            </div>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    )
  return (
    <>
      {chip}
      <Overlay
        open={open}
        onClose={() => onOpen(false)}
        kind="bottom"
        title={SORT_TITLE}
      >
        <div className="nt-sort-label" data-sheet="true">
          {SORT_TITLE}
        </div>
        <div className="nt-sortsheet" role="radiogroup" aria-label={SORT_TITLE}>
          {options}
        </div>
        <div className="nt-dd-sep" />
        <div className="nt-sort-note">
          <InfoIcon aria-hidden="true" />
          {SORT_NOTE}
        </div>
      </Overlay>
    </>
  )
}

function SortRow({
  option,
  checked,
  wide,
  onChange,
}: {
  option: (typeof SORT_OPTIONS)[number]
  checked: boolean
  wide: boolean
  onChange: (value: SortMode) => void
}) {
  const body = (
    <>
      {option.icon}
      <span>{option.label}</span>
      {checked ? (
        <CheckIcon weight="bold" aria-hidden="true" className="nt-sort-check" />
      ) : null}
    </>
  )
  if (wide)
    return (
      <Menu.RadioItem className="nt-dd-item nt-sort-row" value={option.value}>
        {body}
      </Menu.RadioItem>
    )
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className="nt-sort-row"
      onClick={() => onChange(option.value)}
    >
      {body}
    </button>
  )
}

/** 1440 cover stats inline: "15 wants  4 got  $8,692" (B1·06, r2 #9). */
function CoverStats({
  want,
  got,
  total,
  onGot,
}: {
  want: number
  got: number
  total: string | null
  onGot: () => void
}) {
  return (
    <div className="nt-cover-stats">
      <span>
        <b>{want}</b>
        <small>{want === 1 ? 'want' : 'wants'}</small>
      </span>
      <button
        type="button"
        onClick={onGot}
        aria-label={`${got} got. Open the Got page`}
      >
        <b>{got}</b>
        <small>got</small>
      </button>
      {total ? <b className="nt-cover-total">{total}</b> : null}
    </div>
  )
}

/** B4·03: one paper-2 sheet, three silhouettes, a yellow Print CTA. */
function EmptyDesk({ onPrint }: { onPrint: () => void }) {
  return (
    <section
      className="nt-sheet nt-empty-desk"
      data-fill="paper"
      aria-label="Your sheet"
    >
      <div className="nt-empty-sils" aria-hidden="true">
        {COMPACT_SLOTS.map((style, index) => (
          <span key={index} className="nt-eslot" style={style} />
        ))}
      </div>
      <div className="nt-empty-copy">
        {/* C87 / C88. */}
        <b>No stickers yet</b>
        <p>Paste a link to something you want or search by name.</p>
        <button
          type="button"
          className="nt-cta"
          data-tone="yellow"
          onClick={onPrint}
        >
          <PlusIcon weight="bold" aria-hidden="true" />
          Print a sticker
        </button>
        <span className="nt-paste-hint">
          <kbd>Ctrl V</kbd>
          {/* C89. */}
          Or paste a link anywhere
        </span>
      </div>
    </section>
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

/**
 * B2·06 account menu (r7, Q3): header (avatar, name, @handle), Profile
 * (C80), Saved sizes (C81), Currency (C82, value on the right), divider,
 * Sign out (C83). Sharing (C84) is gone: the switches live on each sheet.
 * 1440 is a 260w dropdown; 390 (B2·06b) is a bottom sheet.
 */
function AccountButton({
  user,
  onSignOut,
  size,
  currency,
  sheet = false,
}: {
  user: BoardUser | null
  onSignOut: () => void
  size: number
  currency: string
  /** 390: open as a bottom sheet. */
  sheet?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (!user)
    return (
      <Link to="/sign-in" className="nt-pill" data-tone="white">
        Sign in
      </Link>
    )
  const avatar = (
    <Avatar
      user={user}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        borderWidth: 3,
      }}
    />
  )
  const head = (
    <div className="nt-acct-head">
      <Avatar user={user} />
      <div>
        <b>{user.name}</b>
        {user.username ? <small>@{user.username}</small> : null}
      </div>
    </div>
  )
  if (sheet)
    return (
      <>
        <button
          type="button"
          aria-label="Account menu"
          style={{ borderRadius: '50%' }}
          onClick={() => setOpen(true)}
        >
          {avatar}
        </button>
        <Overlay
          open={open}
          onClose={() => setOpen(false)}
          kind="bottom"
          title="Account"
          className="nt-acct-sheet"
        >
          {head}
          <div className="nt-dd-sep" />
          <nav className="nt-acct-list" aria-label="Account">
            <Link to="/account" className="nt-acct-row">
              <UserCircleIcon aria-hidden="true" />
              Profile
            </Link>
            <span className="nt-acct-row" aria-disabled="true">
              <RulerIcon aria-hidden="true" />
              Saved sizes
            </span>
            <span className="nt-acct-row" aria-disabled="true">
              <CurrencyDollarIcon aria-hidden="true" />
              Currency
              <span className="nt-acct-value">{currency}</span>
            </span>
            <div className="nt-dd-sep" />
            <button
              type="button"
              className="nt-acct-row"
              onClick={() => {
                setOpen(false)
                onSignOut()
              }}
            >
              <SignOutIcon aria-hidden="true" />
              Sign out
            </button>
          </nav>
        </Overlay>
      </>
    )
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          style={{ borderRadius: '50%' }}
        >
          {avatar}
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="nt-layer nt-dd nt-acct"
          align="end"
          sideOffset={8}
        >
          {head}
          <Menu.Separator className="nt-dd-sep" />
          <Menu.Item className="nt-dd-item" asChild>
            <Link to="/account">
              <UserCircleIcon aria-hidden="true" />
              Profile
            </Link>
          </Menu.Item>
          {/* r7: Saved sizes and Currency have no screen yet (flagged). */}
          <Menu.Item className="nt-dd-item" disabled>
            <RulerIcon aria-hidden="true" />
            Saved sizes
          </Menu.Item>
          <Menu.Item className="nt-dd-item" disabled>
            <CurrencyDollarIcon aria-hidden="true" />
            Currency
            <span className="nt-acct-value">{currency}</span>
          </Menu.Item>
          <Menu.Separator className="nt-dd-sep" />
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
  currency,
}: {
  user: BoardUser | null
  currency: string
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
        <AccountButton
          user={user}
          onSignOut={onSignOut}
          size={44}
          currency={currency}
          sheet
        />
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
        <b>{first ? 'No stickers yet' : `${tag} is a blank sheet`}</b>
        <p>
          {first
            ? 'Paste a link to something you want or search by name.'
            : 'Paste a link to print the first sticker.'}
        </p>
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
    onUpdateItem?: (item: GuestItem) => void
    onCopyLink: (item: GuestItem) => void
    onSeeSheet: (key: string) => void
    shareTarget: (key: string | null) => ShareTarget
    sheetShares: Readonly<Record<string, SheetShare>>
    onShareSettings: (keys: Array<string>, next: ShareSettings) => void
    onSharePatch?: (keys: Array<string>, patch: Partial<SheetShare>) => void
    claimLine: (item: GuestItem) => string | null
    onToast: (message: string, undo?: () => void) => void
    topBar: ReactNode
  },
) {
  const { open, setOpen, items } = props
  const close = () => setOpen(null)
  const item =
    open?.kind === 'item' ? items.find((entry) => entry.id === open.id) : null
  const sheet = item ? props.sheetFor(item) : null
  const priceItem =
    open?.kind === 'price' ? items.find((entry) => entry.id === open.id) : null
  const update = props.onUpdateItem
  const moveTargets = [
    ...props.categories.map((category) => ({
      id: category.id,
      tag: categoryTag(category.name),
    })),
    { id: null, tag: 'No category' },
  ]
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
        className={props.wide ? 'nt-itemwide' : undefined}
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
            onShare={
              props.user?.username
                ? () => setOpen({ kind: 'share', key: sheet?.key ?? null })
                : undefined
            }
            moveTargets={moveTargets}
            onMove={
              update
                ? (entry, categoryId) => update({ ...entry, categoryId })
                : undefined
            }
            onEditPrice={
              update
                ? (entry) => setOpen({ kind: 'price', id: entry.id })
                : undefined
            }
            onCopyLink={props.onCopyLink}
            onPrintSticker={printSticker}
            claimLine={props.claimLine(item)}
            wide={props.wide}
          />
        ) : null}
      </Overlay>

      <Overlay
        open={Boolean(priceItem)}
        onClose={() =>
          priceItem ? setOpen({ kind: 'item', id: priceItem.id }) : close()
        }
        kind={props.wide ? 'modal' : 'bottom'}
        title="Price"
        className="nt-price-layer"
      >
        {priceItem && update ? (
          <PriceSheet
            price={priceItem.price}
            fallbackCurrency={pricedCurrency(items)}
            onClose={() => setOpen({ kind: 'item', id: priceItem.id })}
            onSave={(price) => {
              setOpen({ kind: 'item', id: priceItem.id })
              update({ ...priceItem, price })
            }}
          />
        ) : null}
      </Overlay>

      <Overlay
        open={open?.kind === 'got'}
        onClose={close}
        kind="panel"
        title="Got page"
        className="nt-full"
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
          onClose={close}
          wide={props.wide}
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
        kind={props.wide ? 'modal' : 'panel'}
        title="Share sheet"
      >
        {open?.kind === 'share' && props.user?.username ? (
          <ShareSheet
            target={props.shareTarget(open.key)}
            username={props.user.username}
            name={props.user.name}
            origin={props.origin}
            now={props.now}
            settings={shareForTarget(
              props.sheetShares,
              props.shareTarget(open.key).keys,
            )}
            onSettings={(next) =>
              props.onShareSettings(props.shareTarget(open.key).keys, next)
            }
            onStop={
              props.onSharePatch
                ? () => {
                    const patch = props.onSharePatch
                    if (!patch) return () => {}
                    const keys = props.shareTarget(open.key).keys
                    const was = wasSharing(props.sheetShares, keys)
                    patch(keys, { sharing: false })
                    return () => patch(was, { sharing: true })
                  }
                : undefined
            }
            onClose={close}
            onToast={props.onToast}
            onShareAll={
              open.key === null
                ? undefined
                : () =>
                    props.setOpen({
                      kind: 'share',
                      key: null,
                      from: open.key ?? undefined,
                    })
            }
            onOnlySheet={
              open.key === null && open.from !== undefined
                ? () => props.setOpen({ kind: 'share', key: open.from ?? null })
                : undefined
            }
            wide={props.wide}
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

/** The currency most of the owner's priced stickers use (B2·03 default). */
export function pricedCurrency(items: ReadonlyArray<GuestItem>): string {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (item.price)
      counts.set(
        item.price.currency,
        (counts.get(item.price.currency) ?? 0) + 1,
      )
  }
  let best = 'USD'
  let most = 0
  for (const [currency, count] of counts) {
    if (count > most) {
      best = currency
      most = count
    }
  }
  return best
}

/**
 * B2·04 "Print sticker": prints the open sticker on its own (the print
 * stylesheet hides everything but the panel hero). What Print should do is
 * not specced beyond the button; flagged for Bau.
 */
export function printSticker() {
  const root = document.documentElement
  root.classList.add('nt-printing')
  const done = () => {
    root.classList.remove('nt-printing')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
  // Browsers without afterprint (or a blocked dialog) still get cleaned up.
  window.setTimeout(done, 1000)
}

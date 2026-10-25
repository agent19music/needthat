import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  CheckCircleIcon,
  EyeIcon,
  GiftIcon,
  HandGrabbingIcon,
  ListIcon,
  PlusIcon,
  SquaresFourIcon,
  StackIcon,
  XIcon,
} from '@phosphor-icons/react'

import { Avatar, deskRows, useBand, useWide } from '#/components/sticker/board'
import type { DeskCell } from '#/components/sticker/board'
import { Overlay, OverlayClose, Toast } from '#/components/sticker/overlays'
import type { ToastState } from '#/components/sticker/overlays'
import { Sheet } from '#/components/sticker/sheet'
import {
  CoverNote,
  KissCutFilters,
  StickerArt,
} from '#/components/sticker/sticker'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'
import {
  buildSheets,
  captionSub,
  formatPrice,
  gotCountLabel,
  sheetKicker,
  sheetMeta,
} from '#/lib/sticker/sheets'
import type { TagSheet } from '#/lib/sticker/sheets'
import type { LayoutKind } from '#/lib/sticker/layout'
import { claimItem, releaseClaim } from '#/lib/wishlist/public'
import type { PublicSticker, PublicWishlist } from '#/lib/wishlist/types'
import { shareFor } from '#/lib/wishlist/sheet-share'
import {
  CLAIMED_BY_YOU,
  CLAIM_PRIVACY,
  CLAIM_TOAST,
  HOW_CLAIMING,
  HOW_CLOSE,
  HOW_STEPS,
  MAKE_WISHLIST,
  NOTHING_SHARED_LINE,
  NOTHING_SHARED_TITLE,
  UNCLAIM,
  UNSHARED_TITLE,
  unsharedClaimLine,
} from '#/lib/sticker/claim-copy'

/** Public stickers in the shape the sheet renders. */
export function publicItems(stickers: ReadonlyArray<PublicSticker>) {
  return stickers.map((sticker): GuestItem => ({
    id: sticker.id,
    title: sticker.title,
    brand: sticker.brand,
    notes: '',
    sourceUrl: sticker.sourceUrl,
    categoryId: sticker.categoryId,
    status: sticker.status,
    image: null,
    imageType: null,
    imageUrl: sticker.imageUrl,
    position: sticker.position,
    purchasedAt: sticker.purchasedAt,
    price: sticker.price,
    createdAt: sticker.createdAt,
    updatedAt: sticker.createdAt,
  }))
}

type Claim = { claimed: boolean; mine: boolean; caption?: string | null }

/** ?sheet= values for the Got and #unsorted tabs (not category ids). */
const GOT_KEY = 'got'
const UNSORTED_KEY = 'unsorted'

/** S7: a friend's read-only sheet with the claim bottom sheet. */
export function PublicBoard({
  profile,
  sheetId,
  signedIn,
}: {
  profile: PublicWishlist
  sheetId: string | null
  signedIn: boolean
}) {
  const navigate = useNavigate()
  const wide = useWide()
  const band = useBand()
  const now = useMemo(() => Date.now(), [])
  // r7 (Q3, Addendum 3): unshared sheets only carry the viewer's own claims.
  const items = useMemo(
    () => publicItems(profile.items.filter((sticker) => sticker.shared)),
    [profile.items],
  )
  const kept = useMemo(
    () => publicItems(profile.items.filter((sticker) => !sticker.shared)),
    [profile.items],
  )
  const categories = profile.categories as Array<GuestCategory>
  const sets = useMemo(
    () => buildSheets(items, categories),
    [items, categories],
  )
  const keptSets = useMemo(
    () => buildSheets(kept, categories),
    [kept, categories],
  )
  const [claims, setClaims] = useState<Record<string, Claim>>(() =>
    Object.fromEntries(
      profile.items.map((sticker) => [
        sticker.id,
        { claimed: sticker.claimed, mine: sticker.claimedByMe },
      ]),
    ),
  )
  const [open, setOpen] = useState<GuestItem | null>(null)
  const [howOpen, setHowOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastId = useRef(0)

  useEffect(() => {
    document.documentElement.dataset.board = 'sticker'
    return () => {
      delete document.documentElement.dataset.board
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const selected =
    sets.filled.find((sheet) =>
      sheetId === UNSORTED_KEY ? sheet.unsorted : sheet.categoryId === sheetId,
    ) ?? null
  // The requested sheet (or every sheet, for the bare link) is turned off.
  // An unshared sheet's category only comes back with the viewer's claims,
  // so an unknown ?sheet= reads as unshared too.
  const selectedCategoryId: string | null | undefined =
    sheetId === null || sheetId === GOT_KEY
      ? undefined
      : sheetId === UNSORTED_KEY
        ? null
        : sheetId
  const unshared =
    selectedCategoryId === undefined
      ? sheetId === null &&
        !Object.values(profile.sheets).some((entry) => entry.sharing)
      : selectedCategoryId === null
        ? !shareFor(profile.sheets, null).sharing
        : !(
            selectedCategoryId in profile.sheets &&
            profile.sheets[selectedCategoryId].sharing
          )
  const keptShown = unshared
    ? selectedCategoryId !== undefined
      ? keptSets.filled.filter(
          (sheet) => (sheet.categoryId ?? null) === selectedCategoryId,
        )
      : keptSets.filled
    : []
  const keptCount = keptShown.reduce(
    (sum, sheet) => sum + sheet.stickers.length,
    0,
  )
  const first = profile.name.trim().split(/\s+/)[0] || profile.username
  const user = {
    name: profile.name,
    username: profile.username,
    image: profile.image,
  }

  function claimOf(item: GuestItem): Claim {
    const state = claims[item.id] ?? { claimed: false, mine: false }
    // C110 in the C104 slot, on the unshared page only.
    return unshared && state.mine
      ? { ...state, caption: CLAIMED_BY_YOU }
      : state
  }
  const claimsOn = (item: GuestItem) =>
    shareFor(profile.sheets, item.categoryId).allowClaims

  function say(message: string, undo?: () => void) {
    toastId.current += 1
    setToast({ kind: 'info', id: toastId.current, message, undo })
  }

  function choose(id: string | null) {
    void navigate({
      to: '/u/$username',
      params: { username: profile.username },
      search: id ? { sheet: id } : {},
      replace: true,
      resetScroll: false,
    })
  }

  async function claim(item: GuestItem) {
    setBusy(true)
    setError(null)
    try {
      const result = await claimItem({
        data: { username: profile.username, itemId: item.id },
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setClaims((current) => ({
        ...current,
        [item.id]: { claimed: true, mine: true },
      }))
      setOpen(null)
      say(CLAIM_TOAST, () => {
        setToast(null)
        void release(item)
      })
    } catch {
      setError("Couldn't claim it. Try again")
    } finally {
      setBusy(false)
    }
  }

  async function release(item: GuestItem) {
    setBusy(true)
    setError(null)
    try {
      const result = await releaseClaim({ data: { itemId: item.id } })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setClaims((current) => ({
        ...current,
        [item.id]: { claimed: false, mine: false },
      }))
      setOpen(null)
    } catch {
      setError("Couldn't unclaim it. Try again")
    } finally {
      setBusy(false)
    }
  }

  const returnTo = `/u/${profile.username}${sheetId ? `?sheet=${sheetId}` : ''}`
  const openClaim = open ? claimOf(open) : null
  const openSheet = open ? sheetOf(sets.filled, open) : null

  const onOpen = (item: GuestItem) => {
    if (item.status === 'purchased' || !claimsOn(item)) return
    const state = claimOf(item)
    if (state.claimed && !state.mine) return
    if (unshared && !state.mine) return
    setError(null)
    setOpen(item)
  }
  const common = {
    now,
    // Prices come back null on sheets with Show prices off (server).
    showPrice: true,
    claimOf,
    categories,
    allItems: items,
    // r8 (B4·02): no FAB on the public page, so caption bottom + 40.
    fab: false,
    onOpen,
  }
  const wantCount = items.filter((item) => item.status !== 'purchased').length
  const gotCount = sets.got.count
  const gotShown = sheetId === GOT_KEY && gotCount > 0
  const gotSheet = (variant: LayoutKind) => (
    <Sheet
      {...common}
      fill="yellow"
      kicker="GOT PAGE"
      title="Got"
      meta={sheetMeta(gotCount, null)}
      metaPill={gotCountLabel(sets.got.items, now)}
      variant={variant}
      stickers={sets.got.items}
      mode="got"
      onMore={() => choose(GOT_KEY)}
      active
    />
  )
  const sheetEl = (sheet: TagSheet, variant: LayoutKind, active = false) => (
    <Sheet
      key={sheet.key}
      {...common}
      fill={sheet.unsorted ? 'paper' : sheet.color}
      kicker={sheetKicker(sheet.number)}
      title={sheet.tag}
      // B4·01: public sheet meta is the count only.
      meta={sheetMeta(sheet.wanted.length, null)}
      variant={variant}
      stickers={sheet.stickers}
      mode="public"
      active={active}
      onMore={() => choose(sheet.categoryId ?? UNSORTED_KEY)}
    />
  )

  const tabs = (
    <>
      <button
        type="button"
        role="tab"
        className="nt-tab"
        data-fill="all"
        // r8: none active on the unshared page.
        aria-selected={selected === null && !gotShown && !unshared}
        onClick={() => choose(null)}
      >
        #all <b>{wantCount}</b>
      </button>
      {sets.filled.map((sheet) => (
        <button
          key={sheet.key}
          type="button"
          role="tab"
          className="nt-tab"
          data-fill={sheet.unsorted ? 'paper' : sheet.color}
          aria-selected={selected?.key === sheet.key}
          onClick={() => choose(sheet.categoryId ?? UNSORTED_KEY)}
        >
          {sheet.tag} <b>{sheet.wanted.length}</b>
        </button>
      ))}
      {gotCount > 0 ? (
        <button
          type="button"
          role="tab"
          className="nt-tab"
          data-fill="yellow"
          aria-selected={gotShown}
          onClick={() => choose(GOT_KEY)}
        >
          <CheckCircleIcon
            weight="fill"
            aria-hidden="true"
            className="nt-tab-check"
          />
          Got <b>{gotCount}</b>
        </button>
      ) : null}
    </>
  )

  // B4·01 / B4·02 draw the layout switch; public has only the Stacks view
  // today, so Grid and List stay disabled (see PR gaps).
  const seg = (
    <div className="nt-seg" role="group" aria-label="Layout">
      <button type="button" aria-label="Grid" aria-pressed={false} disabled>
        <SquaresFourIcon aria-hidden="true" />
      </button>
      <button type="button" aria-label="Stacks" aria-pressed>
        <StackIcon weight="fill" aria-hidden="true" />
      </button>
      <button type="button" aria-label="List" aria-pressed={false} disabled>
        <ListIcon aria-hidden="true" />
      </button>
    </div>
  )

  const makeOwn = (
    <Link to="/sign-up" className="nt-pill" data-tone="yellow">
      <PlusIcon weight="bold" aria-hidden="true" />
      {MAKE_WISHLIST}
    </Link>
  )

  // C70: hidden when Friends can claim is off (on the open sheet, or on
  // every shared sheet for #all) and on the unshared page.
  const claimable = selected
    ? shareFor(profile.sheets, selected.categoryId).allowClaims
    : profile.allowClaims
  const howButton =
    claimable && !unshared ? (
      <button
        type="button"
        className="nt-pill nt-how"
        data-tone="white"
        onClick={() => setHowOpen(true)}
      >
        <GiftIcon aria-hidden="true" />
        {HOW_CLAIMING}
      </button>
    ) : null

  const overlays = (
    <>
      <Overlay
        open={open !== null}
        onClose={() => setOpen(null)}
        // r8: a centred 440 modal at 1440, no grab handle.
        kind={wide ? 'modal' : 'bottom'}
        className={wide ? 'nt-claim-layer' : undefined}
        title={open ? `Claim ${open.title}` : 'Claim'}
      >
        {open && openClaim ? (
          <>
            <div className="nt-claim-item">
              <div className="nt-claim-thumb">
                <StickerArt item={open} />
              </div>
              <div>
                {open.title}
                <small>
                  {[openSheet?.name, captionSub(open)]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
              {open.price ? <b>{formatPrice(open.price)}</b> : null}
              {wide ? (
                // r9 (Bau): 42 close X at top-right, like the share modal.
                // Esc and a scrim click also close (Radix Dialog).
                <OverlayClose asChild>
                  <button
                    type="button"
                    className="nt-ib nt-claim-x"
                    aria-label="Close"
                  >
                    <XIcon weight="bold" aria-hidden="true" />
                  </button>
                </OverlayClose>
              ) : null}
            </div>
            <div className="nt-info">
              <EyeIcon aria-hidden="true" />
              <span>{CLAIM_PRIVACY}</span>
            </div>
            {error ? <p className="nt-err">{error}</p> : null}
            <div style={{ display: 'flex', marginTop: 24 }}>
              {!signedIn ? (
                <Link
                  to="/sign-in"
                  search={{ redirect: returnTo }}
                  className="nt-cta"
                >
                  <HandGrabbingIcon weight="bold" aria-hidden="true" />
                  Sign in to claim
                </Link>
              ) : openClaim.mine ? (
                <button
                  type="button"
                  className="nt-cta"
                  data-tone="ink"
                  disabled={busy}
                  onClick={() => void release(open)}
                >
                  {UNCLAIM}
                </button>
              ) : (
                <button
                  type="button"
                  className="nt-cta"
                  disabled={busy}
                  onClick={() => void claim(open)}
                >
                  <HandGrabbingIcon weight="bold" aria-hidden="true" />
                  Claim it · I&apos;ll get this
                </button>
              )}
            </div>
          </>
        ) : null}
      </Overlay>

      <Overlay
        open={howOpen}
        onClose={() => setHowOpen(false)}
        kind="bottom"
        title={HOW_CLAIMING}
      >
        <ol className="nt-how-steps">
          {HOW_STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="nt-how-num" data-step={index + 1}>
                {index + 1}
              </span>
              <div>
                <b>{step.title}</b>
                <small>{step.line}</small>
              </div>
            </li>
          ))}
        </ol>
        <div className="nt-info nt-how-privacy">
          <EyeIcon aria-hidden="true" />
          <span>{CLAIM_PRIVACY}</span>
        </div>
        <div style={{ display: 'flex', marginTop: 24 }}>
          <button
            type="button"
            className="nt-cta"
            data-tone="ink"
            onClick={() => setHowOpen(false)}
          >
            {HOW_CLOSE}
          </button>
        </div>
      </Overlay>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  )

  // C78 / C79: sharing is on but nothing is visible.
  const nothingShared = (
    <div className="nt-public-empty">
      <b>{NOTHING_SHARED_TITLE}</b>
      <p>{NOTHING_SHARED_LINE}</p>
    </div>
  )
  // C107 for everyone; C108 and the claimer's own stickers when they have one.
  const unsharedView = (variant: LayoutKind) => (
    <div className="nt-unshared">
      <h2>{UNSHARED_TITLE}</h2>
      {keptCount > 0 ? (
        <>
          <p>{unsharedClaimLine(keptCount)}</p>
          <div className="nt-unshared-sheets">
            {keptShown.map((sheet) => (
              <Sheet
                key={sheet.key}
                {...common}
                fill={sheet.unsorted ? 'paper' : sheet.color}
                kicker={sheetKicker(sheet.number)}
                title={sheet.tag}
                meta={sheetMeta(sheet.stickers.length, null)}
                variant={variant}
                stickers={sheet.stickers}
                mode="public"
                active
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )

  if (!wide) {
    const shown = gotShown ? [] : selected ? [selected] : sets.filled
    return (
      <div className="nt-root nt-mobile nt-public">
        <KissCutFilters />
        <header className="nt-mt">
          <Link to="/" className="nt-word">
            #needthat
          </Link>
          <div className="nt-mt-right">{signedIn ? null : makeOwn}</div>
        </header>
        <div className="nt-pr">
          <div className="nt-pr-id">
            <Avatar user={user} />
            <div style={{ minWidth: 0 }}>
              <h1 className="nt-pr-name">{profile.name || first}</h1>
              <p>
                @{profile.username} · {wantCount}{' '}
                {wantCount === 1 ? 'want' : 'wants'}
              </p>
            </div>
          </div>
        </div>
        <div className="nt-mtools" data-public="true">
          {howButton ?? <span />}
          {seg}
        </div>
        {/* r8: the unshared page always keeps the tabs, so visitors can
            still reach the shared sheets. */}
        {sets.filled.length + (gotCount > 0 ? 1 : 0) > (unshared ? 0 : 1) ? (
          <div className="nt-mtabs" role="tablist" aria-label="Sheets">
            {tabs}
          </div>
        ) : null}
        <div className="nt-msheets">
          {unshared
            ? unsharedView('column')
            : gotShown
              ? gotSheet('got-column')
              : shown.length === 0
                ? nothingShared
                : shown.map((sheet, index) =>
                    sheetEl(sheet, 'column', index === 0),
                  )}
        </div>
        {overlays}
      </div>
    )
  }

  const rows: Array<Array<DeskCell>> = gotShown
    ? []
    : selected
      ? [[{ sheet: selected, kind: 'wall' }]]
      : deskRows(sets.filled, [], gotCount > 0, band)
  return (
    <div className="nt-root nt-public" data-layout="wide">
      <KissCutFilters />
      <header className="nt-top">
        <Link to="/" className="nt-word">
          #needthat
        </Link>
        <div className="nt-top-right">
          {seg}
          {signedIn ? null : (
            <>
              {makeOwn}
              <Link
                to="/sign-in"
                search={{ redirect: returnTo }}
                className="nt-pill"
                data-tone="white"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </header>
      <div className="nt-desk">
        <aside className="nt-cover-col">
          <div className="nt-cover">
            <Avatar user={user} />
            <h1>{profile.name || first}</h1>
            <span className="nt-handle">@{profile.username}</span>
            <div className="nt-cover-stats">
              <span>
                <b>{wantCount}</b>
                <small>{wantCount === 1 ? 'want' : 'wants'}</small>
              </span>
              <span>
                <b>{gotCount}</b>
                <small>got</small>
              </span>
            </div>
            <CoverNote bio={profile.bio} forLine={profile.forLine} />
            {howButton ? <div className="nt-actions">{howButton}</div> : null}
          </div>
        </aside>
        <main className="nt-board-col">
          <div className="nt-tabrow">
            <div className="nt-tabs" role="tablist" aria-label="Sheets">
              {tabs}
            </div>
          </div>
          <div className="nt-board">
            {unshared ? (
              unsharedView('wall')
            ) : gotShown ? (
              <div className="nt-board-grid">{gotSheet('wall')}</div>
            ) : rows.length === 0 ? (
              nothingShared
            ) : (
              <div className="nt-board-grid">
                {rows.map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="nt-row"
                    data-row={row.map((cell) => cell.kind).join(' ')}
                  >
                    {row.map((cell) =>
                      cell.sheet === 'got' ? (
                        <div
                          key="got"
                          className="nt-cell"
                          data-kind={cell.kind}
                        >
                          {gotSheet(cell.kind)}
                        </div>
                      ) : (
                        <div
                          key={cell.sheet.key}
                          className="nt-cell"
                          data-kind={cell.kind}
                        >
                          {sheetEl(cell.sheet, cell.kind, rowIndex === 0)}
                        </div>
                      ),
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      {overlays}
    </div>
  )
}

function sheetOf(sheets: ReadonlyArray<TagSheet>, item: GuestItem) {
  return sheets.find((sheet) => sheet.categoryId === item.categoryId) ?? null
}

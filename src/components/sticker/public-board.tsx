import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  CaretLeftIcon,
  EyeSlashIcon,
  GiftIcon,
  HandGrabbingIcon,
} from '@phosphor-icons/react'

import { Avatar } from '#/components/sticker/board'
import { Overlay, Toast } from '#/components/sticker/overlays'
import type { ToastState } from '#/components/sticker/overlays'
import { Sheet } from '#/components/sticker/sheet'
import { KissCutFilters, StickerArt } from '#/components/sticker/sticker'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'
import {
  buildSheets,
  formatPrice,
  sheetKicker,
  sheetMeta,
} from '#/lib/sticker/sheets'
import type { TagSheet } from '#/lib/sticker/sheets'
import { claimItem, releaseClaim } from '#/lib/wishlist/public'
import type { PublicSticker, PublicWishlist } from '#/lib/wishlist/types'

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

type Claim = { claimed: boolean; mine: boolean }

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
  const now = useMemo(() => Date.now(), [])
  const items = useMemo(() => publicItems(profile.items), [profile.items])
  const categories = profile.categories as Array<GuestCategory>
  const sets = useMemo(
    () => buildSheets(items, categories),
    [items, categories],
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
    sets.filled.find((sheet) => sheet.categoryId === sheetId) ?? null
  const shown = selected ? [selected] : sets.filled
  const first = profile.name.trim().split(/\s+/)[0] || profile.username
  const user = {
    name: profile.name,
    username: profile.username,
    image: profile.image,
  }

  function claimOf(item: GuestItem): Claim {
    return claims[item.id] ?? { claimed: false, mine: false }
  }

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
      say("Claimed. Only you can see it's you", () => {
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

  return (
    <div className="nt-root nt-mobile nt-public">
      <KissCutFilters />
      <div className="nt-tb">
        <Link to="/" className="nt-ib" aria-label="#needthat home">
          <CaretLeftIcon aria-hidden="true" />
        </Link>
        <div className="nt-claim-head">
          <Avatar
            user={user}
            style={{ width: 36, height: 36, fontSize: 12, borderWidth: 3 }}
          />
          <div>
            <h1 style={{ font: 'inherit', margin: 0 }}>
              {first}&apos;s wishlist
            </h1>
            <small>
              @{profile.username}
              {selected ? ` · ${selected.tag}` : ''}
            </small>
          </div>
        </div>
        {profile.allowClaims ? (
          <button
            type="button"
            className="nt-ib"
            aria-label="How claiming works"
            onClick={() => setHowOpen(true)}
          >
            <GiftIcon aria-hidden="true" />
          </button>
        ) : (
          <span style={{ width: 44 }} aria-hidden="true" />
        )}
      </div>

      {sets.filled.length > 1 ? (
        <div className="nt-mtabs" role="tablist" aria-label="Sheets">
          <button
            type="button"
            role="tab"
            className="nt-tab"
            data-fill="all"
            aria-selected={selected === null}
            onClick={() => choose(null)}
          >
            #all{' '}
            <b>{items.filter((item) => item.status !== 'purchased').length}</b>
          </button>
          {sets.filled.map((sheet) => (
            <button
              key={sheet.key}
              type="button"
              role="tab"
              className="nt-tab"
              data-fill={sheet.color}
              aria-selected={selected?.key === sheet.key}
              onClick={() => choose(sheet.categoryId)}
            >
              {sheet.tag} <b>{sheet.wanted.length}</b>
            </button>
          ))}
        </div>
      ) : null}

      <div className="nt-msheets">
        {shown.length === 0 ? (
          <p className="nt-public-empty">Nothing shared yet</p>
        ) : (
          shown.map((sheet, index) => (
            <Sheet
              key={sheet.key}
              fill={sheet.color}
              kicker={sheetKicker(sheet.number)}
              title={sheet.tag}
              meta={sheetMeta(sheet.wanted.length, null)}
              variant="column"
              stickers={sheet.stickers}
              mode="public"
              now={now}
              showPrice={profile.showPrices}
              claimOf={claimOf}
              active={index === 0}
              onOpen={
                profile.allowClaims
                  ? (item) => {
                      if (item.status === 'purchased') return
                      const state = claimOf(item)
                      if (state.claimed && !state.mine) return
                      setError(null)
                      setOpen(item)
                    }
                  : undefined
              }
            />
          ))
        )}
      </div>

      <Overlay
        open={open !== null}
        onClose={() => setOpen(null)}
        kind="bottom"
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
                  {[openSheet?.name, open.sourceUrl ? 'via shop link' : null]
                    .filter(Boolean)
                    .join(' · ') || open.brand}
                </small>
              </div>
              {profile.showPrices && open.price ? (
                <b>{formatPrice(open.price)}</b>
              ) : null}
            </div>
            <div className="nt-info">
              <EyeSlashIcon aria-hidden="true" />
              <span>
                {first} won&apos;t see who claimed it. Friends just see
                it&apos;s taken.
              </span>
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
                  Unclaim
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
        title="How claiming works"
      >
        <div className="nt-info" style={{ marginTop: 0 }}>
          <EyeSlashIcon aria-hidden="true" />
          <span>
            {first} won&apos;t see who claimed it. Friends just see it&apos;s
            taken.
          </span>
        </div>
      </Overlay>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function sheetOf(sheets: ReadonlyArray<TagSheet>, item: GuestItem) {
  return sheets.find((sheet) => sheet.categoryId === item.categoryId) ?? null
}

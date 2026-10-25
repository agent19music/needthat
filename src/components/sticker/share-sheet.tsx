import {
  CaretLeftIcon,
  ChatCircleDotsIcon,
  CurrencyDollarIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  EyeIcon,
  GiftIcon,
  InstagramLogoIcon,
  LinkBreakIcon,
  LinkIcon,
  SquaresFourIcon,
  SquareIcon,
  XIcon,
} from '@phosphor-icons/react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'

import { ShareCard, linkChip } from '#/components/sticker/share-card'
import {
  SHARE_AGAIN,
  STOPPED_ALL_TOAST,
  STOPPED_LINE,
  STOPPED_TITLE,
  STOPPED_TOAST,
} from '#/lib/sticker/claim-copy'
import type { SheetFill } from '#/lib/sticker/sheets'
import { allSheetsMeta, sheetMeta } from '#/lib/sticker/sheets'
import { sheetKey } from '#/lib/wishlist/sheet-share'
import { renderStory } from '#/lib/sticker/story'
import type { GuestItem } from '#/lib/guest-wishlist'

export type ShareTarget = {
  /** Category id for `?sheet=`, or null for the whole list. */
  sheetId: string | null
  /** r7: settings keys this share writes (one sheet, or every sheet). */
  keys: Array<string>
  tag: string
  fill: SheetFill
  stickers: ReadonlyArray<GuestItem>
  total: string | null
}

export type ShareSettings = {
  showPrices: boolean
  allowClaims: boolean
  /** r3 Stop sharing (C101). Undefined reads as on. */
  sharing?: boolean
}

/**
 * Share-link base (r2 open question: domain). `VITE_SHARE_ORIGIN` wins,
 * else the app's own origin.
 */
export function shareOrigin(origin: string) {
  const configured = (
    import.meta.env.VITE_SHARE_ORIGIN as string | undefined
  )?.trim()
  return (configured || origin).replace(/\/+$/, '')
}

export function shareUrl(
  origin: string,
  username: string,
  sheetId: string | null,
) {
  const base = `${shareOrigin(origin)}/u/${encodeURIComponent(username)}`
  return sheetId ? `${base}?sheet=${encodeURIComponent(sheetId)}` : base
}

/**
 * Share sheet. 390 is B3·01 (top bar with "…", card, tray with handle,
 * Copy link / Message / Story / Save image, toggles); wide is the B3·07
 * modal (card left; title, link field, Story / Save image / Message,
 * toggles right). The card follows the §4 share-card rule.
 */
export function ShareSheet({
  target,
  username,
  name,
  origin,
  settings,
  onSettings,
  onClose,
  onToast,
  onShareAll,
  onOnlySheet,
  onStop,
  wide,
}: {
  target: ShareTarget
  username: string
  name: string
  origin: string
  now?: number
  settings: ShareSettings
  onSettings: (next: ShareSettings) => void
  onClose: () => void
  /** `undo` adds the toast's Undo (r4: after Stop sharing). */
  onToast: (message: string, undo?: () => void) => void
  /** "Share all sheets" (Q3): switch the target to the whole list. */
  onShareAll?: () => void
  /** C102 second state: back to the sheet "Share all sheets" came from. */
  onOnlySheet?: () => void
  /**
   * r8 (Bau): stops every sheet in the target and returns the Undo, which
   * restores each sheet's previous sharing state. Only `sharing` changes.
   */
  onStop?: () => () => void
  wide?: boolean
}) {
  const sharing = settings.sharing !== false
  /**
   * r7 (Addendum 1): Stop sharing applies to this sheet straight away, no
   * confirm. The toast's Undo turns it back on. Claims are kept.
   */
  function stop() {
    // r9 (Bau): stopping the whole list (#all) has its own toast.
    const toast = target.sheetId ? STOPPED_TOAST : STOPPED_ALL_TOAST
    if (onStop) {
      onToast(toast, onStop())
      return
    }
    onSettings({ ...settings, sharing: false })
    onToast(toast, () => onSettings({ ...settings, sharing: true }))
  }
  function shareAgain() {
    onSettings({ ...settings, sharing: true })
  }
  /** Sharing the link again turns a stopped page back on (Q7, flagged). */
  function resume() {
    if (!sharing) onSettings({ ...settings, sharing: true })
  }
  const url = shareUrl(origin, username, target.sheetId)
  const first = name.trim().split(/\s+/)[0] || username
  const wanted = target.stickers.filter((item) => item.status !== 'purchased')
  const whole = target.sheetId === null
  // r9 (Bau, COPY-R2 Story flag): the whole list reads "WANJIRU'S SHEETS"
  // and counts with C98 ("5 stickers · 2 sheets"), no prices.
  const kicker = `${first}'s ${whole ? 'sheets' : 'sheet'} · @${username}`
  const countLine = whole
    ? allSheetsMeta(
        wanted.length,
        new Set(wanted.map((item) => sheetKey(item.categoryId))).size,
      )
    : undefined
  const chip = linkChip(url)
  const fileBase = `needthat-${username}-${target.tag.replace(/^#/, '')}`

  async function copy() {
    resume()
    try {
      await navigator.clipboard.writeText(url)
      onToast('Link copied')
    } catch {
      onToast("Couldn't copy the link")
    }
  }

  async function message() {
    resume()
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          url,
          title: `${target.tag} · ${name} on #needthat`,
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    await copy()
  }

  function download(href: string, filename: string) {
    const link = document.createElement('a')
    link.href = href
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function save() {
    resume()
    const query = target.sheetId
      ? `?sheet=${encodeURIComponent(target.sheetId)}`
      : ''
    download(
      `/api/og/u/${encodeURIComponent(username)}${query}`,
      `${fileBase}.png`,
    )
  }

  async function story() {
    resume()
    const blob = await renderStory({
      fill: target.fill,
      kicker,
      title: target.tag,
      items: wanted,
      total: target.total,
      showPrices: settings.showPrices,
      link: chip,
      countLine,
    })
    if (!blob) {
      onToast("Couldn't make the image")
      return
    }
    const file = new File([blob], `${fileBase}-story.png`, {
      type: 'image/png',
    })
    if (
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], url })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    const href = URL.createObjectURL(blob)
    download(href, file.name)
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  const card = (
    <div className="nt-share-card" data-off={sharing ? undefined : 'true'}>
      <ShareCard
        fill={target.fill}
        kicker={kicker}
        title={target.tag}
        stickers={wanted}
        total={target.total}
        showPrices={settings.showPrices}
        link={chip}
        countLine={countLine}
      />
    </div>
  )

  const more = (
    <ShareMenu
      onShareAll={target.sheetId ? onShareAll : undefined}
      onOnlySheet={target.sheetId ? undefined : onOnlySheet}
      onStopSharing={sharing ? stop : undefined}
      previewHref={`/u/${encodeURIComponent(username)}${
        target.sheetId ? `?sheet=${encodeURIComponent(target.sheetId)}` : ''
      }`}
    />
  )

  const toggles = (
    <div className="nt-toggles">
      <Toggle
        label="Show prices"
        icon={<CurrencyDollarIcon aria-hidden="true" />}
        checked={settings.showPrices}
        disabled={!sharing}
        onChange={(showPrices) => onSettings({ ...settings, showPrices })}
      />
      <Toggle
        label="Friends can claim"
        icon={<GiftIcon aria-hidden="true" />}
        checked={settings.allowClaims}
        disabled={!sharing}
        onChange={(allowClaims) => onSettings({ ...settings, allowClaims })}
      />
    </div>
  )

  if (wide) {
    return (
      <div className="nt-share" data-layout="modal">
        {card}
        <div className="nt-share-side">
          <div className="nt-share-head">
            <div className="nt-ttl">
              <b>Share sheet</b>
              <small>
                {target.tag} · {sheetMeta(wanted.length, null)}
              </small>
            </div>
            {more}
            <button
              type="button"
              className="nt-ib"
              aria-label="Close"
              onClick={onClose}
            >
              <XIcon weight="bold" aria-hidden="true" />
            </button>
          </div>
          {sharing ? (
            <div className="nt-share-field">
              <span>{url.replace(/^https?:\/\//, '')}</span>
              <button
                type="button"
                className="nt-pill"
                data-tone="ink"
                onClick={copy}
              >
                <LinkIcon weight="bold" aria-hidden="true" />
                Copy link
              </button>
            </div>
          ) : (
            <div className="nt-share-off">
              <b className="nt-share-off-text">{STOPPED_TITLE}</b>
              <button
                type="button"
                className="nt-pill"
                data-tone="ink"
                onClick={shareAgain}
              >
                <LinkIcon weight="bold" aria-hidden="true" />
                {SHARE_AGAIN}
              </button>
              <small className="nt-share-off-sub">{STOPPED_LINE}</small>
            </div>
          )}
          <div className="nt-share-acts" data-count="3">
            {/* r8: same order as the 390 tray (Message / Story / Save image). */}
            <ShareAct label="Message" disabled={!sharing} onClick={message}>
              <ChatCircleDotsIcon aria-hidden="true" />
            </ShareAct>
            <ShareAct label="Story" disabled={!sharing} onClick={story}>
              <InstagramLogoIcon aria-hidden="true" />
            </ShareAct>
            <ShareAct label="Save image" disabled={!sharing} onClick={save}>
              <DownloadSimpleIcon aria-hidden="true" />
            </ShareAct>
          </div>
          {toggles}
        </div>
      </div>
    )
  }

  return (
    <div className="nt-share">
      <div className="nt-tb">
        <button
          type="button"
          className="nt-ib"
          aria-label="Back"
          onClick={onClose}
        >
          <CaretLeftIcon aria-hidden="true" />
        </button>
        <div className="nt-ttl">
          <b>Share sheet</b>
          <small>
            {target.tag} · {sheetMeta(wanted.length, null)}
          </small>
        </div>
        {more}
      </div>
      {card}
      {sharing ? null : (
        // r5: 390 has no link field, so one line under the faded card.
        <p className="nt-share-off-line">
          <b>{STOPPED_TITLE}</b>
          <small>{STOPPED_LINE}</small>
        </p>
      )}
      <div className="nt-share-tray">
        <span className="nt-share-handle" aria-hidden="true" />
        <div className="nt-share-acts">
          {sharing ? (
            <ShareAct label="Copy link" tone="ink" onClick={copy}>
              <LinkIcon weight="bold" aria-hidden="true" />
            </ShareAct>
          ) : (
            <ShareAct label={SHARE_AGAIN} tone="ink" onClick={shareAgain}>
              <LinkIcon weight="bold" aria-hidden="true" />
            </ShareAct>
          )}
          <ShareAct label="Message" disabled={!sharing} onClick={message}>
            <ChatCircleDotsIcon aria-hidden="true" />
          </ShareAct>
          <ShareAct label="Story" disabled={!sharing} onClick={story}>
            <InstagramLogoIcon aria-hidden="true" />
          </ShareAct>
          <ShareAct label="Save image" disabled={!sharing} onClick={save}>
            <DownloadSimpleIcon aria-hidden="true" />
          </ShareAct>
        </div>
        {toggles}
      </div>
    </div>
  )
}

/**
 * B3·02 "…" menu (250w): Share all sheets (Q3), Preview public page,
 * divider, Stop sharing (red, last). r7: Stop sharing acts at once on this
 * sheet (no confirm; the toast has Undo), disabled while it's off.
 * r4: New link is hidden until a link-token scheme exists.
 */
function ShareMenu({
  onShareAll,
  onOnlySheet,
  previewHref,
  onStopSharing,
}: {
  onShareAll?: () => void
  onOnlySheet?: () => void
  previewHref: string
  onStopSharing?: () => void
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <button
          type="button"
          className="nt-ib nt-ib-ring"
          aria-label="More share options"
        >
          <DotsThreeIcon weight="bold" aria-hidden="true" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="nt-layer nt-dd nt-sortmenu nt-sharemenu"
          align="end"
          sideOffset={10}
        >
          {onShareAll ? (
            <Menu.Item className="nt-sort-row" onSelect={onShareAll}>
              <SquaresFourIcon aria-hidden="true" />
              <span>Share all sheets</span>
            </Menu.Item>
          ) : null}
          {onOnlySheet ? (
            <Menu.Item className="nt-sort-row" onSelect={onOnlySheet}>
              <SquareIcon aria-hidden="true" />
              <span>Only this sheet</span>
            </Menu.Item>
          ) : null}
          <Menu.Item className="nt-sort-row" asChild>
            <a href={previewHref} target="_blank" rel="noreferrer">
              <EyeIcon aria-hidden="true" />
              <span>Preview public page</span>
            </a>
          </Menu.Item>
          <Menu.Separator className="nt-dd-sep" />
          <Menu.Item
            className="nt-sort-row"
            data-tone="red"
            disabled={!onStopSharing}
            onSelect={onStopSharing}
          >
            <LinkBreakIcon aria-hidden="true" />
            <span>Stop sharing</span>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

function ShareAct({
  label,
  tone,
  disabled,
  onClick,
  children,
}: {
  label: string
  tone?: 'ink'
  /** r5: off while sharing is stopped (40%). */
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="nt-share-act"
      data-tone={tone}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{children}</span>
      {label}
    </button>
  )
}

function Toggle({
  label,
  icon,
  checked,
  disabled,
  onChange,
}: {
  label: string
  icon: ReactNode
  checked: boolean
  /** r5: off while sharing is stopped (40%). */
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="nt-toggle"
      onClick={() => onChange(!checked)}
    >
      {icon}
      <span>{label}</span>
      <i className="nt-switch" aria-hidden="true" />
    </button>
  )
}

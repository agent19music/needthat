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
  XIcon,
} from '@phosphor-icons/react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Overlay } from '#/components/sticker/overlays'
import { ShareCard, linkChip } from '#/components/sticker/share-card'
import type { SheetFill } from '#/lib/sticker/sheets'
import { sheetMeta } from '#/lib/sticker/sheets'
import { renderStory } from '#/lib/sticker/story'
import type { GuestItem } from '#/lib/guest-wishlist'

export type ShareTarget = {
  /** Category id for `?sheet=`, or null for the whole list. */
  sheetId: string | null
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
 * Unapproved copy: the Stop sharing confirm (R2 X3), and the r4 stopped
 * state's "Sharing is off" line, "Share again" button and toast.
 */
export const COPY_TBD = '[copy TBD]'

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
  wide?: boolean
}) {
  const [confirm, setConfirm] = useState(false)
  const sharing = settings.sharing !== false
  function stop() {
    setConfirm(false)
    onSettings({ ...settings, sharing: false })
    onToast(COPY_TBD, () => onSettings({ ...settings, sharing: true }))
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
  const kicker = `${first}'s sheet · @${username}`
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
      />
    </div>
  )

  const more = (
    <ShareMenu
      onShareAll={target.sheetId ? onShareAll : undefined}
      onStopSharing={sharing ? () => setConfirm(true) : undefined}
      previewHref={`/u/${encodeURIComponent(username)}${
        target.sheetId ? `?sheet=${encodeURIComponent(target.sheetId)}` : ''
      }`}
    />
  )

  const confirmSheet = (
    <Overlay
      open={confirm}
      onClose={() => setConfirm(false)}
      kind={wide ? 'modal' : 'bottom'}
      title="Stop sharing"
      className="nt-confirm"
    >
      <div className="nt-confirm-head">
        <h2>{COPY_TBD}</h2>
        <button
          type="button"
          className="nt-ib"
          aria-label="Close"
          onClick={() => setConfirm(false)}
        >
          <XIcon aria-hidden="true" />
        </button>
      </div>
      <p className="nt-confirm-body">{COPY_TBD}</p>
      <button type="button" className="nt-cta nt-confirm-go" onClick={stop}>
        Stop sharing
      </button>
    </Overlay>
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
        label="Friends can claim stickers"
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
              <span>{COPY_TBD}</span>
              <button
                type="button"
                className="nt-pill"
                data-tone="ink"
                onClick={shareAgain}
              >
                <LinkIcon weight="bold" aria-hidden="true" />
                {COPY_TBD}
              </button>
            </div>
          )}
          <div className="nt-share-acts" data-count="3">
            <ShareAct label="Story" disabled={!sharing} onClick={story}>
              <InstagramLogoIcon aria-hidden="true" />
            </ShareAct>
            <ShareAct label="Save image" disabled={!sharing} onClick={save}>
              <DownloadSimpleIcon aria-hidden="true" />
            </ShareAct>
            <ShareAct label="Message" disabled={!sharing} onClick={message}>
              <ChatCircleDotsIcon aria-hidden="true" />
            </ShareAct>
          </div>
          {toggles}
        </div>
        {confirmSheet}
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
        <p className="nt-share-off-line">{COPY_TBD}</p>
      )}
      <div className="nt-share-tray">
        <span className="nt-share-handle" aria-hidden="true" />
        <div className="nt-share-acts">
          {sharing ? (
            <ShareAct label="Copy link" tone="ink" onClick={copy}>
              <LinkIcon weight="bold" aria-hidden="true" />
            </ShareAct>
          ) : (
            <ShareAct label={COPY_TBD} tone="ink" onClick={shareAgain}>
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
      {confirmSheet}
    </div>
  )
}

/**
 * B3·02 "…" menu (250w): Share all sheets (Q3), Preview public page,
 * divider, Stop sharing (red, last). Stop sharing confirms in a small sheet
 * ([copy TBD] until R2 X3) and is disabled while sharing is already off.
 * r4: New link is hidden until a link-token scheme exists.
 */
function ShareMenu({
  onShareAll,
  previewHref,
  onStopSharing,
}: {
  onShareAll?: () => void
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

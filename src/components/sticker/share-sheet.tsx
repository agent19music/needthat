import {
  ArrowLeftIcon,
  ChatCircleDotsIcon,
  DownloadSimpleIcon,
  HandGrabbingIcon,
  LinkIcon,
  TagIcon,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import { Sheet } from '#/components/sticker/sheet'
import type { SheetFill } from '#/lib/sticker/sheets'
import { sheetMeta } from '#/lib/sticker/sheets'
import type { GuestItem } from '#/lib/guest-wishlist'

export type ShareTarget = {
  /** Category id for `?sheet=`, or null for the whole list. */
  sheetId: string | null
  tag: string
  fill: SheetFill
  stickers: ReadonlyArray<GuestItem>
  total: string | null
}

export type ShareSettings = { showPrices: boolean; allowClaims: boolean }

export function shareUrl(
  origin: string,
  username: string,
  sheetId: string | null,
) {
  const base = `${origin}/u/${encodeURIComponent(username)}`
  return sheetId ? `${base}?sheet=${encodeURIComponent(sheetId)}` : base
}

/**
 * S8 share sheet. The card is the sheet itself; Copy link / Message / Save
 * image. Story (9:16) is not built yet (gap for Bau/Sean). Toggles are the
 * owner's share settings (Q7 default: per list, not per sheet).
 */
export function ShareSheet({
  target,
  username,
  name,
  origin,
  now,
  settings,
  onSettings,
  onClose,
  onToast,
}: {
  target: ShareTarget
  username: string
  name: string
  origin: string
  now: number
  settings: ShareSettings
  onSettings: (next: ShareSettings) => void
  onClose: () => void
  onToast: (message: string) => void
}) {
  const url = shareUrl(origin, username, target.sheetId)
  const first = name.trim().split(/\s+/)[0] || username
  const wanted = target.stickers.filter((item) => item.status !== 'purchased')
  const meta = sheetMeta(
    wanted.length,
    settings.showPrices ? target.total : null,
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      onToast('Link copied')
    } catch {
      onToast("Couldn't copy the link")
    }
  }

  async function message() {
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

  function save() {
    const query = target.sheetId
      ? `?sheet=${encodeURIComponent(target.sheetId)}`
      : ''
    const link = document.createElement('a')
    link.href = `/api/og/u/${encodeURIComponent(username)}${query}`
    link.download = `needthat-${username}-${target.tag.replace(/^#/, '')}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
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
          <ArrowLeftIcon aria-hidden="true" />
        </button>
        <div className="nt-ttl">
          <b>Share sheet</b>
          <small>
            {target.tag} · {sheetMeta(wanted.length, null)}
          </small>
        </div>
        <span style={{ width: 44 }} aria-hidden="true" />
      </div>
      <div className="nt-share-card">
        <Sheet
          fill={target.fill}
          kicker={`${first}'s sheet · @${username}`}
          title={target.tag}
          meta={meta}
          variant="column"
          stickers={wanted}
          mode="public"
          now={now}
          showPrice={settings.showPrices}
        >
          <span className="nt-share-mark" aria-hidden="true">
            #needthat
          </span>
        </Sheet>
      </div>
      <div className="nt-share-tray">
        <div className="nt-share-acts">
          <ShareAct label="Copy link" tone="ink" onClick={copy}>
            <LinkIcon weight="bold" aria-hidden="true" />
          </ShareAct>
          <ShareAct label="Message" onClick={message}>
            <ChatCircleDotsIcon aria-hidden="true" />
          </ShareAct>
          <ShareAct label="Save image" onClick={save}>
            <DownloadSimpleIcon aria-hidden="true" />
          </ShareAct>
        </div>
        <div className="nt-toggles">
          <Toggle
            label="Show prices"
            icon={<TagIcon aria-hidden="true" />}
            checked={settings.showPrices}
            onChange={(showPrices) => onSettings({ ...settings, showPrices })}
          />
          <Toggle
            label="Friends can claim stickers"
            icon={<HandGrabbingIcon aria-hidden="true" />}
            checked={settings.allowClaims}
            onChange={(allowClaims) => onSettings({ ...settings, allowClaims })}
          />
        </div>
      </div>
    </div>
  )
}

function ShareAct({
  label,
  tone,
  onClick,
  children,
}: {
  label: string
  tone?: 'ink'
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="nt-share-act"
      data-tone={tone}
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
  onChange,
}: {
  label: string
  icon: ReactNode
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="nt-toggle"
      onClick={() => onChange(!checked)}
    >
      {icon}
      <span>{label}</span>
      <i className="nt-switch" aria-hidden="true" />
    </button>
  )
}

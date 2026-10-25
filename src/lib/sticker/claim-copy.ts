/**
 * r7 claim strings (COPY-R2 Addenda 2 and 3). Owner sees who claimed (Q1);
 * visitors only ever see the C86 badge.
 */
import { addedDate } from './sheets.ts'

/** C86: badge on every view. Renders uppercase. */
export const CLAIMED_BADGE = 'Claimed'
/** C77 / C110: the claimer's own badge and caption. */
export const CLAIMED_BY_YOU = 'Claimed by you'
/** C106. */
export const CLAIMED_BY_FRIEND = 'Claimed by a friend'

/** C104 name cut: 12 characters, then "…" (worst case 24 total). */
export const CAPTION_NAME_MAX = 12
/** C105 limit. */
export const DETAIL_MAX = 40

function chars(text: string) {
  return Array.from(text)
}

function cleanName(name: string | null | undefined) {
  const trimmed = (name ?? '').replace(/\s+/g, ' ').trim()
  return trimmed || null
}

/** Cuts to `max` characters plus "…" when longer. */
export function clip(text: string, max: number) {
  const list = chars(text)
  return list.length > max ? `${list.slice(0, max).join('').trimEnd()}…` : text
}

/** C104 owner caption under the sticker (one line, ≤ 24). */
export function ownerCaption(name: string | null | undefined) {
  const clean = cleanName(name)
  return clean
    ? `Claimed by ${clip(clean, CAPTION_NAME_MAX)}`
    : CLAIMED_BY_FRIEND
}

/**
 * C105 owner item detail (1440) and '…' sheet header (390): full name and
 * date, year only for past years. ≤ 40: a name past the 14 the copy sized
 * for is cut with "…" to fit (r7, flagged).
 */
export function ownerClaimLine(
  name: string | null | undefined,
  at: number,
  now: number,
) {
  const date = addedDate(at, now)
  const clean = cleanName(name)
  if (!clean) return `${CLAIMED_BY_FRIEND} on ${date}`
  const fixed = chars(`Claimed by  on ${date}`).length
  const room = Math.max(1, DETAIL_MAX - fixed)
  const shown = chars(clean).length > room ? clip(clean, room - 1) : clean
  return `Claimed by ${shown} on ${date}`
}

/** C107 unshared page title. */
export const UNSHARED_TITLE = "This sheet isn't shared right now"

/** C108, only for someone with a claim. */
export function unsharedClaimLine(count: number) {
  return count === 1 ? 'Your claim is saved.' : 'Your claims are saved.'
}

/** Claim toast (Sean's pick): exactly this, no second line. */
export const CLAIM_TOAST = 'Claimed.'

/** Stopped card (Addendum 1 + C109). */
export const STOPPED_TITLE = 'Your link is turned off'
export const STOPPED_LINE =
  "Friends' claims are kept and come back when you share again."
export const SHARE_AGAIN = 'Share again'
export const STOPPED_TOAST = 'Stopped sharing this sheet'
/** r9 (Bau): the stop toast when Share all sheets (#all) is stopped. */
export const STOPPED_ALL_TOAST = 'Stopped sharing your stickers'

/** Public page copy (COPY-R2 Direction A). */
export const MAKE_WISHLIST = 'Make a wishlist' // C85
export const HOW_CLAIMING = 'How claiming works' // C70
export const HOW_STEPS: ReadonlyArray<{ title: string; line: string }> = [
  {
    title: 'Pick a sticker', // C71
    line: "Tap something on this list you'd like to give as a gift.", // C71b
  },
  {
    title: 'Claim it', // C72
    line: "Sign in and claim it so others know it's taken.", // C72b
  },
  {
    title: 'Buy and give it', // C73
    line: 'Buy it from any shop. The owner marks it as got later.', // C73b
  },
]
export const CLAIM_PRIVACY = 'The owner can see that you claimed it' // C74
export const HOW_CLOSE = 'OK' // C75
export const UNCLAIM = 'Unclaim' // C76
export const NOTHING_SHARED_TITLE = 'No stickers shared yet' // C78
export const NOTHING_SHARED_LINE = 'Sheets this person shares will appear here.' // C79
export const COPY_ITEM_LINK = 'Copy item link' // C43

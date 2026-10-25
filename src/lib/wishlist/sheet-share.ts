import type { SheetShare } from './types.ts'
import { UNSORTED_SHEET } from './types.ts'

/** New sheets start shared, with Show prices and Friends can claim on (Q3). */
export const DEFAULT_SHARE: SheetShare = {
  showPrices: true,
  allowClaims: true,
  sharing: true,
}

/** Settings-map key for a sticker's sheet: its category id, or #unsorted. */
export function sheetKey(categoryId: string | null | undefined) {
  return categoryId ?? UNSORTED_SHEET
}

export function shareFor(
  sheets: Readonly<Record<string, SheetShare>>,
  categoryId: string | null | undefined,
): SheetShare {
  return sheets[sheetKey(categoryId)] ?? DEFAULT_SHARE
}

/**
 * Settings shown for a share target. One sheet: its own. The whole list
 * (Share all sheets): a switch reads on only when every sheet has it on
 * (r7, unspecced: flagged in the PR); sharing reads on while any sheet
 * shares (r8, flagged).
 */
export function shareForTarget(
  sheets: Readonly<Record<string, SheetShare>>,
  keys: ReadonlyArray<string>,
): SheetShare {
  if (keys.length === 0) return DEFAULT_SHARE
  const all = keys.map((key) => sheets[key] ?? DEFAULT_SHARE)
  return {
    showPrices: all.every((entry) => entry.showPrices),
    allowClaims: all.every((entry) => entry.allowClaims),
    // r8: the list counts as shared while any sheet is, so Stop sharing
    // stays available with mixed sheets (Bau's per-sheet Undo).
    sharing: all.some((entry) => entry.sharing),
  }
}

/** True when any shared sheet among `keys` has the switch on. */
export function anyShared(
  sheets: Readonly<Record<string, SheetShare>>,
  keys: ReadonlyArray<string>,
  field: 'showPrices' | 'allowClaims',
) {
  return keys.some((key) => {
    const entry = sheets[key] ?? DEFAULT_SHARE
    return entry.sharing && entry[field]
  })
}

/**
 * X5 og:description. The second sentence drops only when no shared sheet
 * allows claiming (Q3).
 */
export function linkDescription(
  stickers: number,
  sheetCount: number,
  claimable: boolean,
) {
  const count = `${stickers} ${stickers === 1 ? 'sticker' : 'stickers'} across ${sheetCount} ${sheetCount === 1 ? 'sheet' : 'sheets'}.`
  return claimable
    ? `${count} Friends can claim an item to buy it as a gift.`
    : count
}

/** X5 og:title. */
export function linkTitle(name: string) {
  return `${name}'s wishlist on needthat`
}

/**
 * r8 (Bau, Share all sheets): the sheets in `keys` that are sharing now.
 * Stop sharing's Undo turns back on only these, so each sheet returns to
 * its previous state.
 */
export function wasSharing(
  shares: Readonly<Record<string, SheetShare>>,
  keys: ReadonlyArray<string>,
): Array<string> {
  return keys.filter((key) => (shares[key] ?? DEFAULT_SHARE).sharing)
}

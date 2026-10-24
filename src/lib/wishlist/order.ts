/**
 * Pure ordering helpers shared by the server (D1) and the browser (guest store).
 * Free of runtime imports so they can be unit-tested directly.
 */

export type Positioned = {
  id: string
  position?: number | null
  createdAt: number
}

/** Manual position first (ascending). Items without one sort after, newest first. */
export function compareByPosition(left: Positioned, right: Positioned) {
  const a = { ...left, position: left.position ?? null }
  const b = { ...right, position: right.position ?? null }
  if (a.position !== null && b.position !== null && a.position !== b.position)
    return a.position - b.position
  if (a.position !== null && b.position === null) return -1
  if (a.position === null && b.position !== null) return 1
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortByPosition<T extends Positioned>(items: ReadonlyArray<T>) {
  return [...items].sort(compareByPosition)
}

/** A new item goes on top of its pile, so it takes a position below every existing one. */
export function topPosition(positions: ReadonlyArray<number | null>) {
  const known = positions.filter((value): value is number => value !== null)
  return known.length === 0 ? 0 : Math.min(...known) - 1
}

/**
 * Reorders a subset (one stack) and leaves every other item where it is.
 * The whole list is renumbered 0..n-1 in its current order, then the subset's
 * slots are refilled in the requested order, so stacks that interleave in the
 * global order never collide. Returns only the rows whose position changed.
 * Throws when `orderedIds` has duplicates or ids outside `all`.
 */
export function reassignPositions<T extends Positioned>(
  all: ReadonlyArray<T>,
  orderedIds: ReadonlyArray<string>,
): Array<{ id: string; position: number }> {
  const members = new Set(orderedIds)
  if (members.size !== orderedIds.length) throw new Error('Duplicate ids.')
  const byId = new Map(all.map((item) => [item.id, item]))
  for (const id of orderedIds) {
    if (!byId.has(id)) throw new Error('Unknown id.')
  }
  let next = 0
  return sortByPosition(all)
    .map((item) => (members.has(item.id) ? orderedIds[next++] : item.id))
    .map((id, position) => ({ id, position }))
    .filter((row) => byId.get(row.id)?.position !== row.position)
}

/** Moves one entry and returns a new array. The target index is clamped. */
export function moveIndex<T>(list: ReadonlyArray<T>, from: number, to: number) {
  const copy = [...list]
  if (from < 0 || from >= copy.length) return copy
  const clamped = Math.max(0, Math.min(copy.length - 1, to))
  const [entry] = copy.splice(from, 1)
  copy.splice(clamped, 0, entry)
  return copy
}

/** purchasedAt follows status: set on the transition to purchased, kept while purchased, cleared otherwise. */
export function nextPurchasedAt(
  previous: { status: string; purchasedAt: number | null } | null,
  status: 'unresolved' | 'purchased',
  now: number,
) {
  if (status !== 'purchased') return null
  if (previous?.status === 'purchased' && previous.purchasedAt !== null)
    return previous.purchasedAt
  return now
}

export type OfferRow = {
  itemId: string | null
  priceAmount: number | null
  currency: string | null
  observedAt: number
}

export type Price = { amount: number; currency: string }

/** Latest priced offer per item. Offers without an amount or currency never produce a price. */
export function latestPrices(rows: ReadonlyArray<OfferRow>) {
  const best = new Map<string, OfferRow>()
  for (const row of rows) {
    if (!row.itemId || row.priceAmount === null || !row.currency) continue
    const current = best.get(row.itemId)
    if (!current || row.observedAt > current.observedAt)
      best.set(row.itemId, row)
  }
  const prices = new Map<string, Price>()
  for (const [itemId, row] of best)
    prices.set(itemId, {
      amount: row.priceAmount as number,
      currency: row.currency as string,
    })
  return prices
}

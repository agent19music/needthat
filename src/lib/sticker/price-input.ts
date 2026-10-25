/**
 * B2·03 price sheet helpers. Amounts are typed in major units and stored as
 * integer cents plus an ISO 4217 code (r2 §5 "Stored as cents + ISO").
 */

/** Largest amount the account API accepts (see `priceInput`). */
export const MAX_CENTS = 1_000_000_000_00

/**
 * Parses what the owner typed ("50", "1,250.5", "$85") into cents. Returns
 * null for anything that is not a positive amount with at most 2 decimals.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, '').replace(/^[^\d.-]+/, '')
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.split('.')
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS)
    return null
  return cents
}

/** The amount as the owner would type it back: "50", "85.5" → "85.50". */
export function amountText(cents: number | null | undefined): string {
  if (cents == null) return ''
  const whole = Math.floor(cents / 100)
  const fraction = cents % 100
  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(2, '0')}`
}

/** Narrow symbol for the amount prefix ("$", "€", "KSh"); the code if none. */
export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((entry) => entry.type === 'currency')
    return part?.value ?? currency
  } catch {
    return currency
  }
}

import { useState } from 'react'
import { CaretDownIcon, XIcon } from '@phosphor-icons/react'

import {
  amountText,
  currencySymbol,
  parseAmount,
} from '#/lib/sticker/price-input'
import type { Price } from '#/lib/wishlist/types'

/**
 * B2·03 price sheet: currency chip + amount (Funnel Display 700 40) + Save.
 * Copy is the frame's draft (C27 "Price", C34 "Shown on the sticker",
 * C25 "Save"). The currency chip is read-only until Q2 settles the list.
 */
export function PriceSheet({
  price,
  fallbackCurrency = 'USD',
  onSave,
  onClose,
}: {
  price: Price | null | undefined
  fallbackCurrency?: string
  onSave: (price: Price) => void
  onClose: () => void
}) {
  const currency = price?.currency ?? fallbackCurrency
  const [text, setText] = useState(() => amountText(price?.amount))
  const cents = parseAmount(text)
  const symbol = currencySymbol(currency)

  return (
    <form
      className="nt-price"
      onSubmit={(event) => {
        event.preventDefault()
        if (cents === null) return
        onSave({ amount: cents, currency })
      }}
    >
      <div className="nt-price-head">
        <h2>Price</h2>
        <button
          type="button"
          className="nt-ib"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </button>
      </div>
      <div className="nt-price-field">
        <span
          className="nt-price-cur"
          aria-label={`Currency ${currency}`}
          data-q="Q2"
        >
          {currency}
          <CaretDownIcon aria-hidden="true" />
        </span>
        <span className="nt-price-sym" aria-hidden="true">
          {symbol}
        </span>
        <input
          className="nt-price-amt"
          aria-label="Price"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <p className="nt-price-sub">Shown on the sticker</p>
      <button
        type="submit"
        className="nt-cta"
        data-tone="ink"
        disabled={cents === null}
      >
        Save
      </button>
    </form>
  )
}

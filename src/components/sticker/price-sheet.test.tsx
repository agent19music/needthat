import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { PriceSheet } from './price-sheet'

describe('PriceSheet (B2·03)', () => {
  it('disables Save until the amount is valid, then saves cents', () => {
    const onSave = vi.fn()
    render(
      <PriceSheet
        price={null}
        fallbackCurrency="USD"
        onSave={onSave}
        onClose={() => {}}
      />,
    )
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(save).toBeDisabled()
    fireEvent.change(input, { target: { value: '1,250.5' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith({ amount: 125050, currency: 'USD' })
  })

  it('starts from the current price and keeps its currency', () => {
    const onSave = vi.fn()
    render(
      <PriceSheet
        price={{ amount: 8500, currency: 'KES' }}
        onSave={onSave}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('textbox')).toHaveValue('85')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ amount: 8500, currency: 'KES' })
  })
})

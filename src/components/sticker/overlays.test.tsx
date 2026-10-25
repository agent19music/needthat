import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { Overlay, Toast } from './overlays'

describe('Toast Undo over an open modal (r4 Stop sharing)', () => {
  it('Undo works and leaves the modal open', async () => {
    const onClose = vi.fn()
    const undo = vi.fn()
    render(
      <>
        <Overlay open onClose={onClose} kind="modal" title="Share sheet">
          <p>Share</p>
        </Overlay>
        <Toast
          toast={{ kind: 'info', id: 1, message: '[copy TBD]', undo }}
          onDismiss={() => {}}
        />
      </>,
    )
    const button = await screen.findByRole('button', {
      name: 'Undo',
      hidden: true,
    })
    fireEvent.pointerDown(button)
    fireEvent.click(button)
    expect(undo).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Share sheet' })).toBeVisible()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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
    // r9: the modal fades in from opacity 0 (motion). Under a loaded full
    // run the tween can still be at 0 here, which made toBeVisible flaky,
    // so wait for it; the open/close assertion above stays synchronous.
    const dialog = screen.getByRole('dialog', { name: 'Share sheet' })
    await waitFor(() => expect(dialog).toBeVisible())
  })
})

import { Button, Modal } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import { DialogActions } from './dialog-actions'
import actionClasses from './dialog-actions.module.css'
import dialogClasses from './dialog.module.css'

describe('DialogActions', () => {
  it('lays out a dialog form’s buttons and keeps them usable', async () => {
    const { container } = render(
      <DialogActions>
        <Button variant="default">Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogActions>,
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('carries the class that pins it to a phone’s bottom edge, plus any of its own', () => {
    render(
      <DialogActions className="extra" data-testid="actions">
        <Button>Save</Button>
      </DialogActions>,
    )

    const actions = screen.getByTestId('actions')
    expect(actions).toHaveClass(actionClasses.actions as string)
    expect(actions).toHaveClass('extra')
  })
})

describe('dialogs on a phone', () => {
  it('give every dialog the full-screen rule from the theme', () => {
    render(
      <Modal opened onClose={() => {}} title="New task">
        Body
      </Modal>,
    )

    const dialog = screen.getByRole('dialog', { name: 'New task' })
    expect(dialog).toHaveClass(dialogClasses.content as string)
    expect(dialog.closest('.mantine-Modal-root')).toHaveClass(dialogClasses.root as string)
  })

  it('let a confirmation stay a small box', () => {
    render(
      <Modal data-compact opened onClose={() => {}} title="Delete this list?">
        Body
      </Modal>,
    )

    const root = screen
      .getByRole('dialog', { name: 'Delete this list?' })
      .closest('.mantine-Modal-root')
    expect(root).toHaveAttribute('data-compact')
  })
})

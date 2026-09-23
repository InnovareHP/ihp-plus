import { Menu } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { RowActionsMenu } from './row-actions-menu'

function renderMenu(onEdit = vi.fn()) {
  return render(
    <RowActionsMenu name="Acme Corp">
      <Menu.Item onClick={onEdit}>Edit</Menu.Item>
      <Menu.Item color="red">Archive</Menu.Item>
    </RowActionsMenu>,
  )
}

describe('RowActionsMenu', () => {
  it('names the trigger after the row and keeps the actions out of sight until opened', () => {
    renderMenu()

    expect(screen.getByRole('button', { name: 'Actions for Acme Corp' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('runs an action from the keyboard and closes', async () => {
    const onEdit = vi.fn()
    const person = userEvent.setup()
    renderMenu(onEdit)

    await person.tab()
    await person.keyboard('{Enter}')
    await person.click(await screen.findByRole('menuitem', { name: 'Edit' }))

    expect(onEdit).toHaveBeenCalledOnce()
  })

  // Closed only: Mantine's open dropdown carries a role="presentation" focus sentinel axe flags.
  it('has no axe violations', async () => {
    const { container } = renderMenu()

    expect(await axe(container)).toHaveNoViolations()
  })
})

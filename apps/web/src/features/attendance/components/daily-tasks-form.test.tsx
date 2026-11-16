import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { DailyTasksForm } from './daily-tasks-form'

function setup() {
  const onSubmit = vi.fn()
  const view = render(<DailyTasksForm isPending={false} disabled={false} onSubmit={onSubmit} />)
  return { onSubmit, ...view }
}

describe('DailyTasksForm', () => {
  it('asks for three tasks before clocking in', async () => {
    const { onSubmit } = setup()

    await userEvent.type(screen.getByRole('textbox', { name: /task 1/i }), 'Reply to emails')
    await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findAllByRole('alert')).toHaveLength(2)
    expect(screen.getByRole('textbox', { name: /task 2/i })).toHaveFocus()
  })

  it('hands over every task, including extra ones', async () => {
    const { onSubmit } = setup()

    await userEvent.type(screen.getByRole('textbox', { name: /task 1/i }), 'One')
    await userEvent.type(screen.getByRole('textbox', { name: /task 2/i }), 'Two')
    await userEvent.type(screen.getByRole('textbox', { name: /task 3/i }), 'Three')
    await userEvent.click(screen.getByRole('button', { name: 'Add another task' }))
    await userEvent.type(screen.getByRole('textbox', { name: /task 4/i }), 'Four')
    await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

    expect(onSubmit).toHaveBeenCalledWith(['One', 'Two', 'Three', 'Four'])
  })

  it('lets an extra task be removed, but not the required three', async () => {
    setup()

    expect(screen.queryByRole('button', { name: /remove task/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add another task' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove task 4' }))

    expect(screen.queryByRole('textbox', { name: /task 4/i })).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})

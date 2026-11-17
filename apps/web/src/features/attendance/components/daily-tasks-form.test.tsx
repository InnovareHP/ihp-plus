import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import type { BacklogTaskRow } from '../schema'
import { DailyTasksForm } from './daily-tasks-form'

const BACKLOG: BacklogTaskRow[] = [
  { id: 'task-1', name: 'Finish the payroll sheet', dueDate: '2026-11-16', rollovers: 0 },
  { id: 'task-2', name: 'Call the supplier', dueDate: '2026-11-13', rollovers: 2 },
]

function setup(backlog: BacklogTaskRow[] = []) {
  const onSubmit = vi.fn()
  const view = render(
    <DailyTasksForm backlog={backlog} isPending={false} disabled={false} onSubmit={onSubmit} />,
  )
  return { onSubmit, ...view }
}

const NONE = { carriedTaskIds: [], doneTaskIds: [], droppedTaskIds: [] }

describe('DailyTasksForm', () => {
  it('asks for three tasks before clocking in', async () => {
    const { onSubmit } = setup()

    await userEvent.type(screen.getByRole('textbox', { name: /task 1/i }), 'Reply to emails')
    await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 tasks/i)
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

    expect(onSubmit).toHaveBeenCalledWith({ dailyTasks: ['One', 'Two', 'Three', 'Four'], ...NONE })
  })

  it('lets an extra task be removed, but not the required three', async () => {
    setup()

    expect(screen.queryByRole('button', { name: /remove task/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add another task' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove task 4' }))

    expect(screen.queryByRole('textbox', { name: /task 4/i })).not.toBeInTheDocument()
  })

  it('carries leftovers over by default and counts them toward the three', async () => {
    const { onSubmit } = setup(BACKLOG)

    const payroll = screen.getByRole('group', { name: 'Finish the payroll sheet' })
    expect(within(payroll).getByRole('radio', { name: 'Carry over' })).toBeChecked()
    expect(screen.getByText(/carried 2×/)).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: /task 1/i }), 'New thing')
    await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

    expect(onSubmit).toHaveBeenCalledWith({
      dailyTasks: ['New thing'],
      carriedTaskIds: ['task-1', 'task-2'],
      doneTaskIds: [],
      droppedTaskIds: [],
    })
  })

  it('closes a leftover as done or dropped, which no longer counts toward the plan', async () => {
    const { onSubmit } = setup(BACKLOG)

    const payroll = screen.getByRole('group', { name: 'Finish the payroll sheet' })
    const supplier = screen.getByRole('group', { name: 'Call the supplier' })
    await userEvent.click(within(payroll).getByRole('radio', { name: 'Done' }))
    await userEvent.click(within(supplier).getByRole('radio', { name: 'Drop' }))
    await userEvent.type(screen.getByRole('textbox', { name: /task 1/i }), 'One')
    await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 tasks/i)

    await userEvent.type(screen.getByRole('textbox', { name: /task 2/i }), 'Two')
    await userEvent.type(screen.getByRole('textbox', { name: /task 3/i }), 'Three')
    await userEvent.click(screen.getByRole('button', { name: 'Clock in' }))

    expect(onSubmit).toHaveBeenCalledWith({
      dailyTasks: ['One', 'Two', 'Three'],
      carriedTaskIds: [],
      doneTaskIds: ['task-1'],
      droppedTaskIds: ['task-2'],
    })
  })

  it('has no axe violations', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations with leftovers', async () => {
    const { container } = setup(BACKLOG)
    expect(await axe(container)).toHaveNoViolations()
  })
})

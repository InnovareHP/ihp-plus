import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import { DEFAULT_STAGES, type StageInput } from '../schema'
import { StageListEditor } from './stage-list-editor'

function Harness({ counts }: { counts?: Record<string, number> }) {
  const [stages, setStages] = useState<StageInput[]>([...DEFAULT_STAGES])
  return (
    <>
      <StageListEditor stages={stages} onChange={setStages} counts={counts} />
      <output aria-label="Order">{stages.map((stage) => stage.name || '(new)').join(' > ')}</output>
    </>
  )
}

function order() {
  return screen.getByLabelText('Order').textContent
}

describe('StageListEditor', () => {
  it('keeps the entry stage in place with no controls to move or remove it', async () => {
    const { container } = render(<Harness />)

    const first = screen.getAllByRole('listitem')[0] as HTMLElement
    expect(within(first).getByText('New applications land here')).toBeInTheDocument()
    expect(within(first).queryByRole('button')).not.toBeInTheDocument()
    // The first movable stage cannot jump above the entry stage either.
    expect(screen.getByRole('button', { name: 'Move Screening up' })).toBeDisabled()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('reorders, adds and removes stages from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    screen.getByRole('button', { name: 'Move Screening down' }).focus()
    await user.keyboard('{Enter}')
    expect(order()).toBe('Applied > Interview > Screening > Offer')

    screen.getByRole('button', { name: 'Remove Offer' }).focus()
    await user.keyboard('{Enter}')
    expect(order()).toBe('Applied > Interview > Screening')

    await user.click(screen.getByRole('button', { name: 'Add stage' }))
    expect(order()).toBe('Applied > Interview > Screening > (new)')
  })

  it('marks a stage that emails the applicant, and the ones people are sitting in', () => {
    render(<Harness counts={{ interview: 2 }} />)

    const interview = screen.getAllByRole('listitem')[2] as HTMLElement
    expect(within(interview).getByText('Emails the applicant')).toBeInTheDocument()
    expect(within(interview).getByText('2 here now')).toBeInTheDocument()
    expect(
      within(interview).getByRole('button', { name: 'Interview has applicants, so it stays' }),
    ).toBeDisabled()
  })
})

import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import type { LeaveBalance } from '../schema'
import { LeavePreviewNotice } from './leave-preview-notice'

const BALANCE: LeaveBalance = {
  formId: 'form-1',
  formName: 'Vacation leave',
  allowance: 15,
  used: 12,
  pending: 1,
  remaining: 3,
  overridden: false,
}

describe('LeavePreviewNotice', () => {
  it('tells the requester what the dates cost and what they have left', async () => {
    const { container } = render(
      <LeavePreviewNotice preview={{ workingDays: 2, balance: BALANCE }} whose="mine" />,
    )

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('This request uses 2 days of leave')
    expect(notice).toHaveTextContent(
      'You have 3 days of 15 Vacation leave left this year, with 1 day more waiting for approval.',
    )
    expect(screen.queryByText('Over the allowance')).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('warns the requester, without blocking, when the dates go over', () => {
    render(<LeavePreviewNotice preview={{ workingDays: 5, balance: BALANCE }} whose="mine" />)

    expect(screen.getByText('Over the allowance')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'That is 2 days more than you have left. You can still send it; your approver decides.',
    )
  })

  it('names the requester for an approver', () => {
    render(
      <LeavePreviewNotice
        preview={{ workingDays: 4, balance: BALANCE }}
        whose={{ name: 'Grace Hopper' }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Grace Hopper has 3 days of 15 Vacation leave left this year',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Approving it puts them 1 day over their allowance.',
    )
  })

  it('says when the dates are all days off, and skips the balance on an untracked form', () => {
    render(<LeavePreviewNotice preview={{ workingDays: 0, balance: undefined }} whose="mine" />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'These dates fall on days off, so they use no leave.',
    )
    expect(screen.queryByText(/left this year/)).not.toBeInTheDocument()
  })
})

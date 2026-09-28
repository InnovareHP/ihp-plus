import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { FormField } from '@/features/requests/schema'
import type { ScorecardRow } from '../schema'
import { ScorecardForm } from './scorecard-form'

const rpc = vi.hoisted(() => ({ submitScorecard: vi.fn(), getInterview: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

const FIELDS: FormField[] = [
  {
    id: 'strengths',
    type: 'textarea',
    label: 'Strengths',
    help: '',
    placeholder: '',
    required: true,
    options: [],
  },
]

const SAVED: ScorecardRow = {
  interviewId: 'int-1',
  interviewerId: 'user-lead',
  interviewerName: 'Lee',
  recommendation: 'strong_no',
  fields: FIELDS,
  values: { strengths: 'Punctual' },
  updatedAt: '2026-10-14T03:00:00.000Z',
}

function renderForm(mine?: ScorecardRow) {
  return render(
    <ScorecardForm interviewId="int-1" applicantName="Grace Hopper" fields={FIELDS} mine={mine} />,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('ScorecardForm', () => {
  it('asks the posting questions and always the overall recommendation', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Submit scorecard' }))

    expect(await screen.findByText('Strengths is required.')).toBeInTheDocument()
    expect(screen.getByText('Give your overall recommendation.')).toHaveAttribute('role', 'alert')
    expect(rpc.submitScorecard).not.toHaveBeenCalled()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sends the verdict apart from the answers', async () => {
    rpc.submitScorecard.mockResolvedValue({ ...SAVED, recommendation: 'yes' })
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/Strengths/), 'Calm under pressure')
    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('button', { name: 'Submit scorecard' }))

    await waitFor(() =>
      expect(rpc.submitScorecard).toHaveBeenCalledWith({
        interviewId: 'int-1',
        recommendation: 'yes',
        fields: FIELDS,
        answers: { strengths: 'Calm under pressure' },
      }),
    )
  })

  it('reopens a saved scorecard with its answers for changing', () => {
    renderForm(SAVED)

    expect(screen.getByLabelText(/Strengths/)).toHaveValue('Punctual')
    expect(screen.getByRole('radio', { name: 'Strong no' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})

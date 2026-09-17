import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { EvaluationRow } from '../schema'
import { EvaluationForm } from './evaluation-form'

const rpc = vi.hoisted(() => ({
  submitEvaluation: vi.fn(),
  getEvaluation: vi.fn(),
  listMyEvaluations: vi.fn(),
  listEvaluations: vi.fn(),
  assignEvaluations: vi.fn(),
  cancelEvaluation: vi.fn(),
  listCandidates: vi.fn(),
}))

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: vi.fn() }),
}))

const EVALUATION: EvaluationRow = {
  id: 'eval-1',
  formId: 'form-1',
  formName: 'Probationary review',
  fields: [
    {
      id: 'rating',
      type: 'number',
      label: 'Overall rating',
      help: 'One to five.',
      required: true,
      options: [],
      min: 1,
      max: 5,
    },
    {
      id: 'strengths',
      type: 'textarea',
      label: 'Strengths',
      help: '',
      required: true,
      options: [],
    },
    {
      id: 'regularize',
      type: 'checkbox',
      label: 'Recommend for regular status',
      help: '',
      required: false,
      options: [],
    },
  ],
  values: {},
  employeeId: 'user-9',
  employeeName: 'Grace Hopper',
  employeeTeam: 'Care Management',
  employeeEmploymentStatus: 'Probationary',
  evaluatorId: 'user-1',
  evaluatorName: 'Ada Lovelace',
  status: 'pending',
  dueAt: '2026-10-01T23:59:59.999Z',
  submittedAt: undefined,
  createdAt: '2026-09-01T00:00:00.000Z',
  canFill: true,
  isMine: true,
}

const user = () => userEvent.setup()

describe('EvaluationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.submitEvaluation.mockResolvedValue({ ...EVALUATION, status: 'submitted' })
  })

  it('asks the questions the form was assigned with and says nobody approves it', () => {
    render(<EvaluationForm evaluation={EVALUATION} />)

    expect(screen.getByLabelText(/Overall rating/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Strengths/)).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /Recommend for regular status/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Nobody approves this/)).toBeInTheDocument()
  })

  it('refuses to submit until the required questions are answered', async () => {
    const person = user()
    render(<EvaluationForm evaluation={EVALUATION} />)

    await person.click(screen.getByRole('button', { name: 'Submit evaluation' }))

    expect(await screen.findByText('Strengths is required.')).toBeInTheDocument()
    expect(rpc.submitEvaluation).not.toHaveBeenCalled()
  })

  it('submits the answers keyed by field and lands the evaluator on the record', async () => {
    const person = user()
    render(<EvaluationForm evaluation={EVALUATION} />)

    await person.type(screen.getByLabelText(/Overall rating/), '4')
    await person.type(screen.getByLabelText(/Strengths/), 'Calm under pressure.')
    await person.click(screen.getByRole('checkbox', { name: /Recommend for regular status/ }))
    await person.click(screen.getByRole('button', { name: 'Submit evaluation' }))

    await waitFor(() =>
      expect(rpc.submitEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluationId: 'eval-1',
          values: expect.objectContaining({
            rating: 4,
            strengths: 'Calm under pressure.',
            regularize: true,
          }),
        }),
      ),
    )
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/evaluations/view/eval-1'))
  })

  it('puts a server refusal in the form rather than losing what was typed', async () => {
    rpc.submitEvaluation.mockRejectedValue(new Error('This evaluation has already been submitted.'))
    const person = user()
    render(<EvaluationForm evaluation={EVALUATION} />)

    await person.type(screen.getByLabelText(/Overall rating/), '4')
    await person.type(screen.getByLabelText(/Strengths/), 'Calm under pressure.')
    await person.click(screen.getByRole('button', { name: 'Submit evaluation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This evaluation has already been submitted.',
    )
    expect(screen.getByLabelText(/Strengths/)).toHaveValue('Calm under pressure.')
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('explains a form an admin has not finished instead of showing an empty one', () => {
    render(<EvaluationForm evaluation={{ ...EVALUATION, fields: [] }} />)

    expect(screen.getByText('This evaluation has no questions yet')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<EvaluationForm evaluation={EVALUATION} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

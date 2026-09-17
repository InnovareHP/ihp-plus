import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { AssignEvaluationForm } from './assign-evaluation-form'

const rpc = vi.hoisted(() => ({
  submitEvaluation: vi.fn(),
  getEvaluation: vi.fn(),
  listMyEvaluations: vi.fn(),
  listEvaluations: vi.fn(),
  assignEvaluations: vi.fn(),
  cancelEvaluation: vi.fn(),
  listCandidates: vi.fn(),
}))

const formsRpc = vi.hoisted(() => ({
  listForms: vi.fn(),
  getForm: vi.fn(),
  saveForm: vi.fn(),
  setFormStatus: vi.fn(),
  deleteForm: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/features/requests/rpc', () => formsRpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const FORM = {
  id: 'form-1',
  kind: 'evaluation' as const,
  name: 'Probationary review',
  description: '',
  status: 'published' as const,
  fields: [],
  teams: [],
  submissionCount: 0,
  updatedAt: '2026-09-01T00:00:00Z',
}

const PEOPLE = [
  {
    userId: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@innovarehp.com',
    team: 'Information Technology',
    employmentStatus: 'Regular',
  },
  {
    userId: 'user-9',
    name: 'Grace Hopper',
    email: 'grace@innovarehp.com',
    team: 'Care Management',
    employmentStatus: 'Probationary',
  },
]

const user = () => userEvent.setup()

async function pickOption(person: ReturnType<typeof user>, name: RegExp, option: RegExp) {
  await person.click(await screen.findByRole('combobox', { name }))
  await person.click(await screen.findByRole('option', { name: option }))
}

describe('AssignEvaluationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formsRpc.listForms.mockResolvedValue([FORM, { ...FORM, id: 'form-2', status: 'draft' }])
    rpc.listCandidates.mockResolvedValue(PEOPLE)
    rpc.assignEvaluations.mockResolvedValue([
      { id: 'eval-1', employeeName: 'Grace Hopper', status: 'pending' },
    ])
  })

  it('offers only published evaluation forms', async () => {
    const person = user()
    render(<AssignEvaluationForm onDone={vi.fn()} />)

    await waitFor(() => expect(formsRpc.listForms).toHaveBeenCalledWith('evaluation'))
    await person.click(await screen.findByRole('combobox', { name: /Evaluation form/ }))

    expect(await screen.findAllByRole('option')).toHaveLength(1)
  })

  it('assigns the form to the people picked and the supervisor who fills it in', async () => {
    const onDone = vi.fn()
    const person = user()
    render(<AssignEvaluationForm onDone={onDone} />)

    await pickOption(person, /Evaluation form/, /Probationary review/)
    await pickOption(person, /Employees/, /Grace Hopper/)
    await pickOption(person, /Supervisor/, /Ada Lovelace/)
    await person.click(screen.getByRole('button', { name: 'Assign evaluation' }))

    await waitFor(() =>
      expect(rpc.assignEvaluations).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'form-1',
          employeeIds: ['user-9'],
          evaluatorId: 'user-1',
        }),
      ),
    )
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('refuses a supervisor who is also on the list of employees', async () => {
    const person = user()
    render(<AssignEvaluationForm onDone={vi.fn()} />)

    await pickOption(person, /Evaluation form/, /Probationary review/)
    await pickOption(person, /Employees/, /Ada Lovelace/)
    await pickOption(person, /Supervisor/, /Ada Lovelace/)
    await person.click(screen.getByRole('button', { name: 'Assign evaluation' }))

    expect(
      await screen.findByText('Nobody evaluates themselves — pick a different supervisor.'),
    ).toBeInTheDocument()
    expect(rpc.assignEvaluations).not.toHaveBeenCalled()
  })

  it('puts a server refusal in the form', async () => {
    rpc.assignEvaluations.mockRejectedValue(
      new Error('Everyone you picked already has this evaluation waiting.'),
    )
    const person = user()
    render(<AssignEvaluationForm onDone={vi.fn()} />)

    await pickOption(person, /Evaluation form/, /Probationary review/)
    await pickOption(person, /Employees/, /Grace Hopper/)
    await pickOption(person, /Supervisor/, /Ada Lovelace/)
    await person.click(screen.getByRole('button', { name: 'Assign evaluation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Everyone you picked already has this evaluation waiting.',
    )
  })

  it('has no axe violations', async () => {
    const { container } = render(<AssignEvaluationForm onDone={vi.fn()} />)
    await screen.findByRole('combobox', { name: /Evaluation form/ })
    expect(await axe(container)).toHaveNoViolations()
  })
})

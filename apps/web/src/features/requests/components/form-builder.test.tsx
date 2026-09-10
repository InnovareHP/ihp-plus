import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { FormRow } from '../schema'
import { FormBuilder } from './form-builder'

const rpc = vi.hoisted(() => ({
  listForms: vi.fn(),
  getForm: vi.fn(),
  saveForm: vi.fn(),
  setFormStatus: vi.fn(),
  deleteForm: vi.fn(),
}))

const organization = vi.hoisted(() => ({ listTeams: vi.fn() }))
const nav = vi.hoisted(() => ({ replace: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/features/organization/actions', () => organization)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
}))

const TEAM = { id: 'team-1', name: 'Finance', memberCount: 3, createdAt: '2026-01-01T00:00:00Z' }

const SAVED: FormRow = {
  id: 'form-1',
  name: 'Equipment request',
  description: '',
  status: 'draft',
  submissionCount: 0,
  updatedAt: '2026-09-01T00:00:00Z',
  teams: [],
  fields: [],
}

const user = () => userEvent.setup()

describe('FormBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    organization.listTeams.mockResolvedValue({ ok: true, data: [TEAM] })
    rpc.saveForm.mockResolvedValue(SAVED)
    rpc.setFormStatus.mockResolvedValue({ ...SAVED, status: 'published' })
  })

  it('says why a new form cannot be published yet', async () => {
    render(<FormBuilder />)

    expect(await screen.findByText('Add at least one question.')).toBeInTheDocument()
    expect(screen.getByText('Pick at least one department.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('adds a question and asks for its label', async () => {
    const person = user()
    render(<FormBuilder />)

    await person.click(screen.getAllByRole('button', { name: 'Add question' })[0] as HTMLElement)

    expect(await screen.findByText('Question 1')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Label/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Required' })).toBeInTheDocument()
  })

  it('offers option entry only once a question is a choice', async () => {
    const person = user()
    render(<FormBuilder />)

    await person.click(screen.getAllByRole('button', { name: 'Add question' })[0] as HTMLElement)
    expect(screen.queryByText('Press Enter after each one.')).not.toBeInTheDocument()

    await person.click(await screen.findByRole('combobox', { name: 'Answer type' }))
    await person.click(await screen.findByRole('option', { name: 'Choice' }))

    expect(await screen.findByText('Press Enter after each one.')).toBeInTheDocument()
  })

  it('refuses to save a question with no label', async () => {
    const person = user()
    render(<FormBuilder />)

    await person.type(await screen.findByLabelText(/Form name/), 'Equipment request')
    await person.click(screen.getAllByRole('button', { name: 'Add question' })[0] as HTMLElement)
    await person.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Give the question a label.')).toBeInTheDocument()
    expect(rpc.saveForm).not.toHaveBeenCalled()
  })

  it('saves a draft and moves off the new-form URL once it has an id', async () => {
    const person = user()
    render(<FormBuilder />)

    await person.type(await screen.findByLabelText(/Form name/), 'Equipment request')
    await person.click(screen.getAllByRole('button', { name: 'Add question' })[0] as HTMLElement)
    await person.type(screen.getByLabelText(/^Label/), 'Item needed')
    await person.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(rpc.saveForm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Equipment request',
          fields: [expect.objectContaining({ label: 'Item needed', type: 'text' })],
        }),
      ),
    )
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/requests/forms/form-1'))
  })

  it('puts a server refusal in the form instead of a toast', async () => {
    rpc.saveForm.mockRejectedValue(new Error('Only an admin can manage request forms.'))
    const person = user()
    render(<FormBuilder />)

    await person.type(await screen.findByLabelText(/Form name/), 'Equipment request')
    await person.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Only an admin can manage request forms.')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<FormBuilder form={SAVED} />)
    await screen.findByLabelText(/Form name/)
    expect(await axe(container)).toHaveNoViolations()
  })
})

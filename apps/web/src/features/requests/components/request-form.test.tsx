import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { FormRow } from '../schema'
import { withTimeOffFields } from '../time-off'
import { RequestForm } from './request-form'

const rpc = vi.hoisted(() => ({
  submitRequest: vi.fn(),
  listAvailableForms: vi.fn(),
  listMyRequests: vi.fn(),
  listRequests: vi.fn(),
  getRequest: vi.fn(),
  decideRequest: vi.fn(),
  withdrawRequest: vi.fn(),
}))

const actions = vi.hoisted(() => ({ uploadRequestFile: vi.fn() }))
vi.mock('../actions', () => actions)

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: vi.fn() }),
}))

const FORM: FormRow = {
  id: 'form-1',
  kind: 'request',
  name: 'Equipment request',
  description: 'Ask for a laptop, monitor or headset.',
  status: 'published',
  submissionCount: 0,
  updatedAt: '2026-09-01T00:00:00Z',
  timeOff: false,
  teams: [{ id: 'team-1', name: 'Information Technology' }],
  fields: [
    {
      id: 'item',
      type: 'text',
      label: 'Item needed',
      help: 'One item per request.',
      placeholder: '',
      required: true,
      options: [],
    },
    {
      id: 'reason',
      type: 'textarea',
      label: 'Reason',
      help: '',
      placeholder: '',
      required: true,
      options: [],
    },
    {
      id: 'size',
      type: 'select',
      label: 'Size',
      help: '',
      placeholder: '',
      required: false,
      options: ['Small', 'Large'],
    },
    {
      id: 'urgent',
      type: 'checkbox',
      label: 'Needed urgently',
      help: '',
      placeholder: '',
      required: false,
      options: [],
    },
  ],
}

const user = () => userEvent.setup()

describe('RequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.submitRequest.mockResolvedValue({ ...FORM, id: 'req-9', formName: FORM.name })
  })

  it('renders each admin-defined question as the control its type calls for', () => {
    render(<RequestForm form={FORM} />)

    expect(screen.getByLabelText(/Item needed/)).toBeInTheDocument()
    expect(screen.getByText('One item per request.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Size/ })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Needed urgently/ })).toBeInTheDocument()
  })

  it('refuses time off whose last day comes before the first', async () => {
    const person = userEvent.setup()
    render(<RequestForm form={{ ...FORM, timeOff: true, fields: withTimeOffFields([]) }} />)

    await person.type(screen.getByLabelText(/First day off/), '2026-10-09')
    await person.type(screen.getByLabelText(/Last day off/), '2026-10-05')
    await person.click(screen.getByRole('button', { name: 'Send request' }))

    expect(
      await screen.findByText('The last day off cannot be before the first.'),
    ).toBeInTheDocument()
    expect(rpc.submitRequest).not.toHaveBeenCalled()
    expect(screen.getByText(/these days show as leave on your time clock/)).toBeInTheDocument()
  })

  it('refuses to send until the required questions are answered', async () => {
    const person = user()
    render(<RequestForm form={FORM} />)

    await person.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText('Item needed is required.')).toBeInTheDocument()
    expect(screen.getByText('Reason is required.')).toBeInTheDocument()
    expect(rpc.submitRequest).not.toHaveBeenCalled()
  })

  it('sends the answers keyed by field and lands the user on what they created', async () => {
    const person = user()
    render(<RequestForm form={FORM} />)

    await person.type(screen.getByLabelText(/Item needed/), 'Laptop')
    await person.type(screen.getByLabelText(/Reason/), 'Mine will not charge.')
    await person.click(screen.getByRole('checkbox', { name: /Needed urgently/ }))
    await person.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() =>
      expect(rpc.submitRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'form-1',
          values: expect.objectContaining({
            item: 'Laptop',
            reason: 'Mine will not charge.',
            urgent: true,
          }),
        }),
      ),
    )
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/requests/view/req-9'))
  })

  it('puts a server refusal in the form rather than losing what was typed', async () => {
    rpc.submitRequest.mockRejectedValue(new Error('That form is not open to your department.'))
    const person = user()
    render(<RequestForm form={FORM} />)

    await person.type(screen.getByLabelText(/Item needed/), 'Laptop')
    await person.type(screen.getByLabelText(/Reason/), 'Mine will not charge.')
    await person.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That form is not open to your department.',
    )
    expect(screen.getByLabelText(/Item needed/)).toHaveValue('Laptop')
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('explains a form an admin has not finished instead of showing an empty form', () => {
    render(<RequestForm form={{ ...FORM, fields: [] }} />)

    expect(screen.getByText('This form has no questions yet')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<RequestForm form={FORM} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('RequestForm with a file question', () => {
  const EXPENSE: FormRow = {
    ...FORM,
    name: 'Expense reimbursement',
    fields: [
      {
        id: 'receipt',
        type: 'file',
        label: 'Receipt',
        help: 'A photo or PDF of the receipt.',
        placeholder: '',
        required: true,
        options: [],
      },
    ],
  }

  const receipt = () => new File(['%PDF-1.7'], 'lunch.pdf', { type: 'application/pdf' })
  const fileInput = (container: HTMLElement) =>
    container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement

  beforeEach(() => {
    vi.clearAllMocks()
    rpc.submitRequest.mockResolvedValue({ ...FORM, id: 'req-9', formName: EXPENSE.name })
  })

  it('uploads the file when it is picked and sends its id with the request', async () => {
    actions.uploadRequestFile.mockResolvedValue({
      ok: true,
      data: { id: 'file-1', fileName: 'lunch.pdf' },
    })
    const person = user()
    const { container } = render(<RequestForm form={EXPENSE} />)

    await person.upload(fileInput(container), receipt())

    expect(await screen.findByText('Uploaded — it is sent with the request.')).toBeInTheDocument()
    const sent = actions.uploadRequestFile.mock.calls[0]?.[0] as FormData
    expect(sent.get('formId')).toBe('form-1')
    expect(sent.get('fieldId')).toBe('receipt')

    await person.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() =>
      expect(rpc.submitRequest).toHaveBeenCalledWith(
        expect.objectContaining({ values: { receipt: 'file-1' } }),
      ),
    )
  })

  it('asks for the file before sending when a required one is missing', async () => {
    const person = user()
    render(<RequestForm form={EXPENSE} />)

    await person.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText('Attach receipt.')).toBeInTheDocument()
    expect(rpc.submitRequest).not.toHaveBeenCalled()
  })

  it('announces a refused upload and leaves nothing attached', async () => {
    actions.uploadRequestFile.mockResolvedValue({
      ok: false,
      message: 'File storage is not configured yet — tell an admin to set the S3 variables.',
    })
    const person = user()
    const { container } = render(<RequestForm form={EXPENSE} />)

    await person.upload(fileInput(container), receipt())

    expect(await screen.findByRole('alert')).toHaveTextContent('File storage is not configured')
    await person.click(screen.getByRole('button', { name: 'Send request' }))
    expect(rpc.submitRequest).not.toHaveBeenCalled()
  })

  it('refuses a file type it cannot take without uploading it', async () => {
    const person = userEvent.setup({ applyAccept: false })
    const { container } = render(<RequestForm form={EXPENSE} />)

    await person.upload(
      fileInput(container),
      new File(['x'], 'setup.exe', { type: 'application/x-msdownload' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Upload a PDF, Office document, text file or image.',
    )
    expect(actions.uploadRequestFile).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = render(<RequestForm form={EXPENSE} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

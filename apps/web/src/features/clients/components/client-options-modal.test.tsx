import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { emptyOptionMap } from '../schema'
import { ClientOptionsModal } from './client-options-modal'

const actions = vi.hoisted(() => ({
  addClientOptions: vi.fn(),
  archiveClientOption: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const OPTIONS = { ...emptyOptionMap(), clientType: ['Hospital', 'Hospice'] }

const user = () => userEvent.setup()

function renderModal() {
  return render(
    <ClientOptionsModal opened onClose={() => {}} options={OPTIONS} initialKind="clientType" />,
  )
}

describe('ClientOptionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.addClientOptions.mockResolvedValue({ ok: true, data: { added: 2, skipped: 1 } })
    actions.archiveClientOption.mockResolvedValue({ ok: true, data: null })
  })

  it('lists the values a field already has', () => {
    renderModal()

    expect(screen.getByText('Client types values (2)')).toBeInTheDocument()
    expect(screen.getByText('Hospital')).toBeInTheDocument()
  })

  it('adds a pasted list in one call and says what it skipped', async () => {
    const person = user()
    renderModal()

    await person.type(
      screen.getByRole('textbox', { name: /Add client types in bulk/ }),
      'Payer, Broker; Hospital',
    )

    // The count is reported before the click, so the paste can be checked first.
    expect(screen.getByText('2 to add, 1 already in the list')).toBeInTheDocument()

    await person.click(screen.getByRole('button', { name: /Add 2 values/ }))

    expect(actions.addClientOptions).toHaveBeenCalledWith({
      kind: 'clientType',
      values: ['Payer', 'Broker', 'Hospital'],
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Added 2 values, skipped 1 already in the list.',
    )
  })

  it('will not submit an empty or fully duplicate paste', async () => {
    const person = user()
    renderModal()
    const box = screen.getByRole('textbox', { name: /Add client types in bulk/ })

    expect(screen.getByRole('button', { name: /Add value/ })).toBeDisabled()

    await person.type(box, 'Hospital\nhospice')
    expect(screen.getByText('0 to add, 2 already in the list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add value/ })).toBeDisabled()
  })

  it('announces a refusal from the server', async () => {
    actions.addClientOptions.mockResolvedValue({ ok: false, message: 'Paste at least one value.' })
    const person = user()
    renderModal()

    await person.type(screen.getByRole('textbox', { name: /Add client types in bulk/ }), 'Payer')
    await person.click(screen.getByRole('button', { name: /Add 1 value/ }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Paste at least one value.' }),
      ),
    )
  })

  it('retires a value instead of deleting it', async () => {
    const person = user()
    renderModal()

    await person.click(screen.getByRole('button', { name: 'Retire Hospice' }))

    expect(actions.archiveClientOption).toHaveBeenCalledWith({
      kind: 'clientType',
      value: 'Hospice',
    })
  })

  it('switches to another field and keeps its own list', async () => {
    const person = user()
    renderModal()

    await person.click(screen.getByRole('combobox', { name: 'Field' }))
    await person.click(screen.getByRole('option', { name: 'Service lines' }))

    expect(screen.getByText('Service lines values (0)')).toBeInTheDocument()
    expect(screen.getByText(/No values yet/)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderModal()

    expect(await axe(container)).toHaveNoViolations()
  })
})

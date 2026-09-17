import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { LookupOptionsModal } from './lookup-options-modal'

const actions = vi.hoisted(() => ({
  listLookupOptions: vi.fn(),
  addLookupOptions: vi.fn(),
  retireLookupOption: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('@/features/lookups/actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const KINDS = ['clientType', 'clientTag'] as const
const LISTS = { clientType: ['Hospital', 'Hospice'], clientTag: [] }

const user = () => userEvent.setup()

function renderModal() {
  return render(
    <LookupOptionsModal
      opened
      onClose={() => {}}
      kinds={KINDS}
      lists={LISTS}
      initialKind="clientType"
    />,
  )
}

describe('LookupOptionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.addLookupOptions.mockResolvedValue({ ok: true, data: { added: 2, skipped: 1 } })
    actions.retireLookupOption.mockResolvedValue({ ok: true, data: null })
  })

  it('lists the values the chosen list already holds', () => {
    renderModal()

    expect(screen.getByText('Client types (2)')).toBeInTheDocument()
    expect(screen.getByText('Hospital')).toBeInTheDocument()
  })

  it('offers only the lists this screen owns', async () => {
    const person = user()
    renderModal()

    await person.click(screen.getByRole('combobox', { name: 'List' }))

    expect(screen.getByRole('option', { name: 'Client tags' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Positions' })).not.toBeInTheDocument()
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

    expect(actions.addLookupOptions).toHaveBeenCalledWith({
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

    expect(screen.getByRole('button', { name: /Add value/ })).toBeDisabled()

    await person.type(
      screen.getByRole('textbox', { name: /Add client types in bulk/ }),
      'Hospital\nhospice',
    )

    expect(screen.getByText('0 to add, 2 already in the list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add value/ })).toBeDisabled()
  })

  it('announces a refusal from the server', async () => {
    actions.addLookupOptions.mockResolvedValue({
      ok: false,
      message: 'Only an admin can change a dropdown list.',
    })
    const person = user()
    renderModal()

    await person.type(screen.getByRole('textbox', { name: /Add client types in bulk/ }), 'Payer')
    await person.click(screen.getByRole('button', { name: /Add 1 value/ }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Only an admin can change a dropdown list.' }),
      ),
    )
  })

  it('retires a value by name instead of deleting it', async () => {
    const person = user()
    renderModal()

    await person.click(screen.getByRole('button', { name: 'Retire Hospice' }))

    expect(actions.retireLookupOption).toHaveBeenCalledWith({
      kind: 'clientType',
      value: 'Hospice',
    })
  })

  it('switches to another list and keeps its own values', async () => {
    const person = user()
    renderModal()

    await person.click(screen.getByRole('combobox', { name: 'List' }))
    await person.click(screen.getByRole('option', { name: 'Client tags' }))

    expect(screen.getByText('Client tags (0)')).toBeInTheDocument()
    expect(screen.getByText(/No values yet/)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderModal()

    expect(await axe(container)).toHaveNoViolations()
  })
})

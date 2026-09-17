import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { AcceptContractForm } from './accept-contract-form'

const actions = vi.hoisted(() => ({ acceptContract: vi.fn() }))
const nav = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('../accept-actions', () => actions)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: nav.refresh, replace: vi.fn(), push: vi.fn() }),
}))

function renderForm() {
  return render(
    <AcceptContractForm
      contractId="contract-1"
      signature="sig"
      clientName="Riverside Care Center"
    />,
  )
}

describe('AcceptContractForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    actions.acceptContract.mockResolvedValue({ ok: true })
  })

  it('accepts with the typed name and re-reads the contract as accepted', async () => {
    const person = userEvent.setup()
    renderForm()

    await person.type(screen.getByRole('textbox', { name: /your full name/i }), 'Dana Reyes')
    await person.click(
      screen.getByRole('checkbox', { name: /agree to it on behalf of Riverside Care Center/ }),
    )
    await person.click(screen.getByRole('button', { name: 'Accept contract' }))

    await waitFor(() =>
      expect(actions.acceptContract).toHaveBeenCalledWith({
        contractId: 'contract-1',
        signature: 'sig',
        fullName: 'Dana Reyes',
        agree: true,
      }),
    )
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled())
  })

  it('announces what is missing and never reaches the server', async () => {
    const person = userEvent.setup()
    renderForm()

    await person.click(screen.getByRole('button', { name: 'Accept contract' }))

    expect(await screen.findByText('Type your full name to accept')).toBeInTheDocument()
    expect(screen.getByText('Tick the box to confirm you agree')).toBeInTheDocument()
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('textbox', { name: /your full name/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(actions.acceptContract).not.toHaveBeenCalled()
  })

  it('shows why the portal refused and keeps what was typed', async () => {
    actions.acceptContract.mockResolvedValue({
      ok: false,
      message: 'This contract has already been accepted.',
    })
    const person = userEvent.setup()
    renderForm()

    await person.type(screen.getByRole('textbox', { name: /your full name/i }), 'Dana Reyes')
    await person.click(screen.getByRole('checkbox'))
    await person.click(screen.getByRole('button', { name: 'Accept contract' }))

    expect(await screen.findByText('This contract has already been accepted.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /your full name/i })).toHaveValue('Dana Reyes')
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = renderForm()

    expect(await axe(container)).toHaveNoViolations()
  })
})

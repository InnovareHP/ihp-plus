import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { ContractDetail } from '../schema'
import { ContractBody } from './contract-body'

const rpc = vi.hoisted(() => ({
  setContractStatus: vi.fn(),
  listContractInvoices: vi.fn(),
  listContractActivity: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const SENT: ContractDetail = {
  id: 'contract-1',
  reference: 'IHP-C-0007',
  title: 'Growth retainer',
  clientId: 'client-1',
  clientName: 'Riverside Care Center',
  status: 'sent',
  billingCycle: 'monthly',
  subtotalCents: 250_000,
  startDate: undefined,
  endDate: undefined,
  signedAt: undefined,
  createdAt: '2026-09-01T00:00:00.000Z',
  isBilled: false,
  terms: undefined,
  clientLink: undefined,
  viewedAt: undefined,
  acceptedByName: undefined,
  lines: [
    {
      id: 'line-1',
      catalogItemId: undefined,
      name: 'Social management',
      description: undefined,
      unitPriceCents: 250_000,
      quantity: 1,
      unit: 'month',
    },
  ],
}

function renderBody(contract: ContractDetail = SENT, billingEnabled = true) {
  return render(
    <ContractBody contract={contract} canManage billingEnabled={billingEnabled} onEdit={vi.fn()} />,
  )
}

describe('ContractBody', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    rpc.setContractStatus.mockResolvedValue({ ...SENT, status: 'active', isBilled: true })
    rpc.listContractInvoices.mockResolvedValue([])
    rpc.listContractActivity.mockResolvedValue([])
  })

  it('offers the client link to copy while the contract waits on the client', () => {
    renderBody({
      ...SENT,
      clientLink: 'https://portal.ihp.test/app/contract/contract-1/sig',
      viewedAt: '2026-09-12T00:00:00.000Z',
    })

    expect(screen.getByRole('textbox', { name: 'Link to send by hand' })).toHaveValue(
      'https://portal.ihp.test/app/contract/contract-1/sig',
    )
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    expect(screen.getByText(/They opened it on September 12, 2026/)).toBeInTheDocument()
  })

  it('lists the invoices of a billed contract and flags a failed payment', async () => {
    rpc.listContractInvoices.mockResolvedValue([
      {
        id: 'in_2',
        status: 'open',
        amountDueCents: 250_000,
        amountPaidCents: 0,
        currency: 'usd',
        hostedInvoiceUrl: 'https://invoice.stripe.com/i/2',
        paidAt: undefined,
        failedAt: '2026-10-03T00:00:00.000Z',
        failureReason: 'Your card was declined.',
        periodStart: undefined,
        periodEnd: undefined,
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    ])
    renderBody({ ...SENT, status: 'active', isBilled: true })

    expect(await screen.findByText('Payment failed')).toBeInTheDocument()
    expect(screen.getByText('Your card was declined.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'View the invoice issued Oct 1, 2026 (opens in a new tab)',
      }),
    ).toHaveAttribute('href', 'https://invoice.stripe.com/i/2')
    expect(rpc.listContractInvoices).toHaveBeenCalledWith('contract-1')
  })

  it('does not ask for invoices on a contract that is not billed', () => {
    renderBody()

    expect(rpc.listContractInvoices).not.toHaveBeenCalled()
  })

  it('offers a retry when the invoices cannot be loaded', async () => {
    rpc.listContractInvoices.mockRejectedValue(new Error('The portal could not be reached.'))
    renderBody({ ...SENT, status: 'active', isBilled: true })

    expect(await screen.findByText('The portal could not be reached.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('asks before an agreement that starts billing, naming the client it invoices', async () => {
    renderBody()

    await userEvent.click(screen.getByRole('button', { name: 'Mark as agreed' }))

    const dialog = screen.getByRole('dialog', { name: 'Agree IHP-C-0007 and start billing?' })
    expect(dialog).toHaveTextContent('Stripe invoices Riverside Care Center every month')
    expect(rpc.setContractStatus).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Agree and start billing' }))

    expect(rpc.setContractStatus).toHaveBeenCalledWith({
      contractId: 'contract-1',
      status: 'active',
    })
  })

  it('keeps the contract as sent when the manager backs out', async () => {
    renderBody()

    await userEvent.click(screen.getByRole('button', { name: 'Mark as agreed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Keep as sent' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rpc.setContractStatus).not.toHaveBeenCalled()
  })

  it('states the full amount a one-off contract invoices today', async () => {
    renderBody({ ...SENT, billingCycle: 'project' })

    await userEvent.click(screen.getByRole('button', { name: 'Mark as agreed' }))

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Stripe emails Riverside Care Center an invoice for $2,500 today.',
    )
  })

  it('agrees without asking when this portal does not bill', async () => {
    renderBody(SENT, false)

    await userEvent.click(screen.getByRole('button', { name: 'Mark as agreed' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rpc.setContractStatus).toHaveBeenCalledWith({
      contractId: 'contract-1',
      status: 'active',
    })
  })

  it('announces why billing was refused, and keeps the error on screen', async () => {
    rpc.setContractStatus.mockRejectedValue(
      new Error('Could not update billing for IHP-C-0007, so the contract was left as it was.'),
    )
    renderBody()

    await userEvent.click(screen.getByRole('button', { name: 'Mark as agreed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agree and start billing' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith({
        color: 'red',
        autoClose: false,
        message: 'Could not update billing for IHP-C-0007, so the contract was left as it was.',
      }),
    )
  })

  it('holds the other transitions while one is on its way to Stripe', async () => {
    rpc.setContractStatus.mockReturnValue(new Promise(() => {}))
    renderBody({ ...SENT, status: 'active', isBilled: true })

    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeDisabled()
  })

  it('shows whether an agreed contract is billed in Stripe', () => {
    const { unmount } = renderBody({ ...SENT, status: 'active', isBilled: true })
    expect(screen.getByText('Billed in Stripe')).toBeInTheDocument()
    unmount()

    renderBody({ ...SENT, status: 'active', isBilled: false }, false)
    expect(
      screen.getByText('Billing is not set up for this portal, so this contract is not invoiced.'),
    ).toBeInTheDocument()
  })

  it('has no axe violations with the confirmation open', async () => {
    const { container } = renderBody()

    await userEvent.click(screen.getByRole('button', { name: 'Mark as agreed' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})

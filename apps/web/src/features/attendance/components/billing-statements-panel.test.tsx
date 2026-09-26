import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { BillingStatementRow } from '../schema'
import { BillingStatementsPanel } from './billing-statements-panel'

const rpc = vi.hoisted(() => ({ listBillingStatements: vi.fn(), deleteBillingStatement: vi.fn() }))
const print = vi.hoisted(() => ({ printHtml: vi.fn() }))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn(), UNDO_WINDOW_MS: 8000 }))
const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('../utils/billing-statement', async (original) => ({
  ...(await original<typeof import('../utils/billing-statement')>()),
  printHtml: print.printHtml,
}))
vi.mock('@/lib/undo', () => undo)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))

const STATEMENT: BillingStatementRow = {
  id: 'st-1',
  userId: 'user-1',
  contractorName: 'Dana Reyes',
  position: 'Designer',
  invoiceNumber: 'INV-20260930',
  invoiceDate: '2026-09-30',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  daysWorked: 20,
  hoursWorked: 160,
  dailyRateCents: 4_500,
  bonusCents: 5_000,
  expenses: [{ description: 'Internet', amountCents: 2_500 }],
  wiseLink: 'https://wise.com/pay/r/abc',
  totalCents: 97_500,
  createdAt: '2026-09-30T08:00:00.000Z',
}

describe('BillingStatementsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listBillingStatements.mockResolvedValue([STATEMENT])
    rpc.deleteBillingStatement.mockResolvedValue(undefined)
  })

  it('lists a saved statement with its period and total', async () => {
    render(<BillingStatementsPanel />)

    expect(await screen.findByText('INV-20260930')).toBeInTheDocument()
    expect(screen.getByText('September 1, 2026 – September 30, 2026')).toBeInTheDocument()
    expect(screen.getByText('$975.00')).toBeInTheDocument()
  })

  it('says how to fill an empty list', async () => {
    rpc.listBillingStatements.mockResolvedValue([])
    render(<BillingStatementsPanel />)

    expect(await screen.findByText('No billing statements yet')).toBeInTheDocument()
  })

  it('prints a statement again exactly as it was saved', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Print INV-20260930' }))

    const html = String(print.printHtml.mock.calls[0]?.[0])
    expect(html).toContain('Internet')
    expect(html).toContain('$975.00 USD')
  })

  it('removes a statement at once, and deletes it only when the undo window closes', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Delete INV-20260930' }))

    await waitFor(() => expect(screen.queryByText('INV-20260930')).not.toBeInTheDocument())
    expect(rpc.deleteBillingStatement).not.toHaveBeenCalled()

    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
    await waitFor(() => expect(rpc.deleteBillingStatement).toHaveBeenCalledWith('st-1'))
  })

  it('puts the statement back on undo', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Delete INV-20260930' }))
    undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

    expect(await screen.findByText('INV-20260930')).toBeInTheDocument()
    expect(rpc.deleteBillingStatement).not.toHaveBeenCalled()
  })

  it('brings the row back and announces why when the delete fails', async () => {
    rpc.deleteBillingStatement.mockRejectedValue(new Error('That statement is no longer there.'))
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Delete INV-20260930' }))
    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'That statement is no longer there.' }),
      ),
    )
    // The failed delete refetches, and the server still has the row.
    expect(await screen.findByText('INV-20260930')).toBeInTheDocument()
  })

  it('shows an admin whose each statement is, with no delete', async () => {
    render(<BillingStatementsPanel everyone />)

    expect(await screen.findByText('Dana Reyes')).toBeInTheDocument()
    expect(rpc.listBillingStatements).toHaveBeenCalledWith({ everyone: true })
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<BillingStatementsPanel />)
    await screen.findByText('INV-20260930')
    expect(await axe(container)).toHaveNoViolations()
  })
})

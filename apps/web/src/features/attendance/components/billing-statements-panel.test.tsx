import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { BillingStatementRow } from '../schema'
import { BillingStatementsPanel } from './billing-statements-panel'

// DataTable pages its own rows into the URL, so the table reads the router.
vi.mock('next/navigation', () => ({
  usePathname: () => '/attendance',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}))

const rpc = vi.hoisted(() => ({ listBillingStatements: vi.fn(), deleteBillingStatement: vi.fn() }))
const print = vi.hoisted(() => ({ printHtml: vi.fn() }))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn(), UNDO_WINDOW_MS: 8000 }))
const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))
const download = vi.hoisted(() => ({ downloadFile: vi.fn() }))
const mail = vi.hoisted(() => ({ openMailto: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('../utils/billing-statement', async (original) => ({
  ...(await original<typeof import('../utils/billing-statement')>()),
  printHtml: print.printHtml,
}))
vi.mock('@/lib/undo', () => undo)
vi.mock('@/lib/download', () => download)
vi.mock('@/lib/mailto', () => mail)
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
  hourlyRateCents: 4_500,
  fixedPay: false,
  bonusCents: 5_000,
  expenses: [{ description: 'Internet', amountCents: 2_500 }],
  wiseLink: 'https://wise.com/pay/r/abc',
  sendTo: 'payroll@ihp.test',
  totalCents: 727_500,
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
    expect(screen.getByText('$7,275.00')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '160.00' })).toBeInTheDocument()
  })

  it('says how to fill an empty list', async () => {
    rpc.listBillingStatements.mockResolvedValue([])
    render(<BillingStatementsPanel />)

    expect(await screen.findByText('No billing statements yet')).toBeInTheDocument()
  })

  it('prints a statement again exactly as it was saved, on the letterhead', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Actions for INV-20260930' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Print' }))

    await waitFor(() => expect(print.printHtml).toHaveBeenCalledOnce())
    const html = String(print.printHtml.mock.calls[0]?.[0])
    expect(html).toContain('Internet')
    expect(html).toContain('$7,275.00 USD')
    expect(html).toContain('class="band band-top"')
  })

  it('downloads a saved statement again as a PDF', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Actions for INV-20260930' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Download PDF' }))

    await waitFor(() => expect(download.downloadFile).toHaveBeenCalledOnce())
    expect(download.downloadFile.mock.calls[0]?.[0].fileName).toMatch(/INV-20260930\.pdf$/)
  })

  it('opens an email for a saved statement, addressed to its recipient, with the PDF to attach', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Actions for INV-20260930' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Create email' }))

    await waitFor(() => expect(mail.openMailto).toHaveBeenCalledOnce())
    expect(mail.openMailto.mock.calls[0]?.[0]).toMatch(/^mailto:payroll%40ihp\.test\?/)
    expect(download.downloadFile.mock.calls[0]?.[0].fileName).toMatch(/INV-20260930\.pdf$/)
  })

  it('removes a statement at once, and deletes it only when the undo window closes', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Actions for INV-20260930' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('INV-20260930')).not.toBeInTheDocument())
    expect(rpc.deleteBillingStatement).not.toHaveBeenCalled()

    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
    await waitFor(() => expect(rpc.deleteBillingStatement).toHaveBeenCalledWith('st-1'))
  })

  it('puts the statement back on undo', async () => {
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Actions for INV-20260930' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

    expect(await screen.findByText('INV-20260930')).toBeInTheDocument()
    expect(rpc.deleteBillingStatement).not.toHaveBeenCalled()
  })

  it('brings the row back and announces why when the delete fails', async () => {
    rpc.deleteBillingStatement.mockRejectedValue(new Error('That statement is no longer there.'))
    const user = userEvent.setup()
    render(<BillingStatementsPanel />)

    await user.click(await screen.findByRole('button', { name: 'Actions for INV-20260930' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'That statement is no longer there.' }),
      ),
    )
    // The failed delete refetches, and the server still has the row.
    expect(await screen.findByText('INV-20260930')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<BillingStatementsPanel />)
    await screen.findByText('INV-20260930')
    expect(await axe(container)).toHaveNoViolations()
  })
})

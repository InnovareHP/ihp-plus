import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import type { AttendanceAbsenceRow, AttendanceDayRow, BillingStatementRow } from '../schema'
import { BillingStatementButton } from './billing-statement-button'

const rpc = vi.hoisted(() => ({
  listBillingStatements: vi.fn(),
  saveBillingStatement: vi.fn(),
  getStatementDefaults: vi.fn(),
}))

vi.mock('../rpc', () => rpc)

const LAST: BillingStatementRow = {
  id: 'st-1',
  userId: 'user-1',
  contractorName: 'Dana Reyes',
  position: 'Designer',
  invoiceNumber: 'INV-20260831',
  invoiceDate: '2026-08-31',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  daysWorked: 21,
  hoursWorked: 168,
  dailyRateCents: 6_000,
  fixedPay: false,
  bonusCents: 0,
  expenses: [],
  wiseLink: 'https://wise.com/pay/r/abc',
  totalCents: 126_000,
  createdAt: '2026-08-31T08:00:00.000Z',
}

const DAYS = [
  { workDate: '2026-09-01', workedSeconds: 8 * 3600 },
  { workDate: '2026-09-02', workedSeconds: 8 * 3600 },
] as AttendanceDayRow[]

const PAID_OFF = [{ workDate: '2026-09-03', kind: 'leave', paid: true }] as AttendanceAbsenceRow[]

describe('BillingStatementButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listBillingStatements.mockResolvedValue([LAST])
    rpc.getStatementDefaults.mockResolvedValue({
      contractorName: 'Dana Reyes',
      position: 'Senior designer',
      fixedPay: false,
    })
  })

  it('opens on the timesheet’s days, paid leave included, and the last statement’s rate', async () => {
    const user = userEvent.setup()
    render(
      <BillingStatementButton
        days={DAYS}
        absences={PAID_OFF}
        from="2026-09-01"
        to="2026-09-30"
        today="2026-09-30"
      />,
    )
    // The last statement arrives before the form is opened, as it would on a settled page.
    await screen.findByRole('button', { name: 'Billing statement' })
    await vi.waitFor(() => expect(rpc.listBillingStatements).toHaveBeenCalled())
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Billing statement' })).toBeEnabled(),
    )

    await user.click(screen.getByRole('button', { name: 'Billing statement' }))

    expect(await screen.findByLabelText(/Days worked/)).toHaveValue('3')
    expect(screen.getByLabelText(/Hours worked/)).toHaveValue('16')
    expect(screen.getByText('Days worked includes 1 paid day off.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Invoice number/)).toHaveValue('INV-20260930')
    // The profile wins over whatever the last statement said.
    expect(screen.getByText('Senior designer')).toBeInTheDocument()
    expect(screen.getByLabelText(/Daily rate/)).toHaveValue('$60')
    expect(screen.getByLabelText(/Wise payment link/)).toHaveValue('https://wise.com/pay/r/abc')
  })

  it('does not carry a daily rate over to someone now on fixed pay', async () => {
    rpc.getStatementDefaults.mockResolvedValue({
      contractorName: 'Dana Reyes',
      position: 'Senior designer',
      fixedPay: true,
    })
    const user = userEvent.setup()
    render(
      <BillingStatementButton
        days={DAYS}
        absences={PAID_OFF}
        from="2026-09-01"
        to="2026-09-30"
        today="2026-09-30"
      />,
    )
    await vi.waitFor(() => expect(rpc.listBillingStatements).toHaveBeenCalled())
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Billing statement' })).toBeEnabled(),
    )

    await user.click(screen.getByRole('button', { name: 'Billing statement' }))

    expect(await screen.findByLabelText(/Fixed amount/)).toHaveValue('')
  })

  it('waits for the timesheet before it can open', () => {
    render(
      <BillingStatementButton
        days={undefined}
        absences={undefined}
        from="2026-09-01"
        to="2026-09-30"
        today="2026-09-30"
      />,
    )

    expect(screen.getByRole('button', { name: 'Billing statement' })).toBeDisabled()
  })
})

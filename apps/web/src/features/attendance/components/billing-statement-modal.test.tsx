import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { BillingStatementValues } from '../schema'
import { BillingStatementModal } from './billing-statement-modal'

const print = vi.hoisted(() => ({ printHtml: vi.fn() }))
const rpc = vi.hoisted(() => ({ saveBillingStatement: vi.fn(), listBillingStatements: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../utils/billing-statement', async (original) => ({
  ...(await original<typeof import('../utils/billing-statement')>()),
  printHtml: print.printHtml,
}))
vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const INITIAL: BillingStatementValues = {
  contractorName: 'Dana Reyes',
  position: '',
  invoiceNumber: 'INV-20260930',
  invoiceDate: '2026-09-30',
  daysWorked: 20,
  hoursWorked: 160,
  dailyRateCents: 0,
  bonusCents: 0,
  expenses: [],
  wiseLink: '',
}

const FILLED: BillingStatementValues = {
  ...INITIAL,
  position: 'Designer',
  dailyRateCents: 6_000,
  wiseLink: 'https://wise.com/x',
}

function open(initial = INITIAL, onClose = vi.fn(), paidDaysOff = 0) {
  render(
    <BillingStatementModal
      opened
      onClose={onClose}
      period={{ from: '2026-09-01', to: '2026-09-30' }}
      paidDaysOff={paidDaysOff}
      initial={initial}
    />,
  )
  return onClose
}

describe('BillingStatementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    print.printHtml.mockReset()
    rpc.listBillingStatements.mockResolvedValue([])
    rpc.saveBillingStatement.mockResolvedValue({ id: 'st-1' })
  })

  it('starts from the timesheet', () => {
    open()

    expect(screen.getByLabelText(/Full name/)).toHaveValue('Dana Reyes')
    expect(screen.getByLabelText(/Days worked/)).toHaveValue('20')
    expect(screen.getByLabelText(/Hours worked/)).toHaveValue('160')
  })

  it('says how many of the days were paid leave', () => {
    open(INITIAL, vi.fn(), 2)

    expect(screen.getByText('Days worked includes 2 paid days off.')).toBeInTheDocument()
  })

  it('asks for the position, rate and Wise link before saving', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: 'Save and print' }))

    expect(await screen.findByText('Enter your position or role.')).toBeInTheDocument()
    expect(screen.getByText('Enter your daily rate.')).toBeInTheDocument()
    expect(
      screen.getByText('Paste your Wise payment link, starting with https://.'),
    ).toBeInTheDocument()
    expect(rpc.saveBillingStatement).not.toHaveBeenCalled()
    expect(print.printHtml).not.toHaveBeenCalled()
  })

  it('totals the bill as it is typed, saves it with the period, then prints it', async () => {
    const user = userEvent.setup()
    const onClose = open()

    await user.type(screen.getByLabelText(/Position/), 'Virtual assistant')
    await user.type(screen.getByLabelText(/Daily rate/), '45')
    await user.type(screen.getByLabelText(/^Bonus/), '50')
    await user.click(screen.getByRole('button', { name: 'Add an expense' }))
    await user.type(screen.getByLabelText('Expense 1'), 'Internet')
    await user.type(screen.getByLabelText('Expense 1 amount'), '25')
    await user.type(screen.getByLabelText(/Wise payment link/), 'https://wise.com/pay/r/abc')

    expect(screen.getByText('$975.00 USD')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save and print' }))

    await waitFor(() =>
      expect(rpc.saveBillingStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 'Virtual assistant',
          dailyRateCents: 4_500,
          bonusCents: 5_000,
          expenses: [{ description: 'Internet', amountCents: 2_500 }],
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
        }),
      ),
    )
    await waitFor(() => expect(print.printHtml).toHaveBeenCalledOnce())
    expect(String(print.printHtml.mock.calls[0]?.[0])).toContain('$975.00 USD')
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps the form, says why and prints nothing when the server refuses', async () => {
    rpc.saveBillingStatement.mockRejectedValue(
      new Error('The billing period ends before it starts.'),
    )
    const user = userEvent.setup()
    const onClose = open(FILLED)

    await user.click(screen.getByRole('button', { name: 'Save and print' }))

    expect(
      await screen.findAllByText('The billing period ends before it starts.'),
    ).not.toHaveLength(0)
    expect(screen.getByLabelText(/Position/)).toHaveValue('Designer')
    expect(print.printHtml).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('says the statement is saved when only the print view fails', async () => {
    print.printHtml.mockImplementation(() => {
      throw new Error('blocked')
    })
    const user = userEvent.setup()
    const onClose = open(FILLED)

    await user.click(screen.getByRole('button', { name: 'Save and print' }))

    expect(
      await screen.findByText(/The statement is saved, but the print view/),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = render(
      <BillingStatementModal
        opened
        onClose={vi.fn()}
        period={{ from: '2026-09-01', to: '2026-09-30' }}
        initial={INITIAL}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

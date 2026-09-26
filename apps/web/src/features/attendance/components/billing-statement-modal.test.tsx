import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { BillingStatementValues } from '../schema'
import { BillingStatementModal } from './billing-statement-modal'

const print = vi.hoisted(() => ({ printHtml: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../utils/billing-statement', async (original) => ({
  ...(await original<typeof import('../utils/billing-statement')>()),
  printHtml: print.printHtml,
}))
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

const SAVED = JSON.stringify({
  position: 'Designer',
  dailyRateCents: 6_000,
  wiseLink: 'https://wise.com/x',
})

function open(onClose = vi.fn()) {
  render(
    <BillingStatementModal
      opened
      onClose={onClose}
      period={{ from: '2026-09-01', to: '2026-09-30' }}
      initial={INITIAL}
    />,
  )
  return onClose
}

describe('BillingStatementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    print.printHtml.mockReset()
    window.localStorage.clear()
  })

  it('starts from the timesheet', () => {
    open()

    expect(screen.getByLabelText(/Full name/)).toHaveValue('Dana Reyes')
    expect(screen.getByLabelText(/Days worked/)).toHaveValue('20')
    expect(screen.getByLabelText(/Hours worked/)).toHaveValue('160')
  })

  it('asks for the position, rate and Wise link before printing', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: 'Print statement' }))

    expect(await screen.findByText('Enter your position or role.')).toBeInTheDocument()
    expect(screen.getByText('Enter your daily rate.')).toBeInTheDocument()
    expect(
      screen.getByText('Paste your Wise payment link, starting with https://.'),
    ).toBeInTheDocument()
    expect(print.printHtml).not.toHaveBeenCalled()
  })

  it('totals the bill as it is typed and prints it with the expenses', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Print statement' }))

    await waitFor(() => expect(print.printHtml).toHaveBeenCalledOnce())
    const html = String(print.printHtml.mock.calls[0]?.[0])
    expect(html).toContain('Virtual assistant')
    expect(html).toContain('Internet')
    expect(html).toContain('$975.00 USD')
    expect(onClose).toHaveBeenCalled()
  })

  it('remembers the position, rate and link for next time', () => {
    window.localStorage.setItem('ihp.billing-statement.defaults', SAVED)
    open()

    expect(screen.getByLabelText(/Position/)).toHaveValue('Designer')
    expect(screen.getByLabelText(/Daily rate/)).toHaveValue('$60')
    expect(screen.getByLabelText(/Wise payment link/)).toHaveValue('https://wise.com/x')
  })

  it('keeps the form and says why when printing fails', async () => {
    print.printHtml.mockImplementation(() => {
      throw new Error('blocked')
    })
    window.localStorage.setItem('ihp.billing-statement.defaults', SAVED)
    const user = userEvent.setup()
    const onClose = open()

    await user.click(screen.getByRole('button', { name: 'Print statement' }))

    expect(await screen.findByText(/Could not open the print view/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Position/)).toHaveValue('Designer')
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

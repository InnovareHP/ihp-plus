import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { ShiftHolidays } from './shift-holidays'

const rpc = vi.hoisted(() => ({
  listHolidays: vi.fn(),
  saveHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
  importHolidays: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn() }))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn(), UNDO_WINDOW_MS: 8000 }))

vi.mock('../rpc', () => rpc)
vi.mock('@/lib/undo', () => undo)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const YEAR = new Date().getFullYear()
const COUNTRIES = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States of America' },
]
const RIZAL = { id: 'h-1', date: `${YEAR}-12-30`, name: 'Rizal Day', country: 'PH', imported: true }
const JULY_4 = {
  id: 'h-2',
  date: `${YEAR}-07-04`,
  name: 'Independence Day',
  country: 'US',
  imported: true,
}
const FOUNDERS = {
  id: 'h-3',
  date: `${YEAR}-03-01`,
  name: 'Founders Day',
  country: '',
  imported: false,
}

function renderFor(country = 'PH') {
  return render(<ShiftHolidays country={country} countries={COUNTRIES} />)
}

describe('ShiftHolidays', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listHolidays.mockResolvedValue({ holidays: [FOUNDERS, JULY_4, RIZAL], canManage: true })
    rpc.saveHoliday.mockResolvedValue({ ...RIZAL, id: 'h-9' })
    rpc.deleteHoliday.mockResolvedValue(undefined)
    rpc.importHolidays.mockResolvedValue([RIZAL])
  })

  it("lists the shift's own country and the company-wide days, never another country's", async () => {
    renderFor('PH')

    expect(await screen.findByText('Rizal Day')).toBeInTheDocument()
    const founders = screen.getByText('Founders Day').closest('tr') as HTMLElement
    expect(within(founders).getByText('Everyone')).toBeInTheDocument()
    expect(screen.queryByText('Independence Day')).not.toBeInTheDocument()
    expect(rpc.listHolidays).toHaveBeenCalledWith(YEAR)
  })

  it('shows only company-wide days for a shift that follows no country, with no fill button', async () => {
    renderFor('')

    expect(await screen.findByText('Founders Day')).toBeInTheDocument()
    expect(screen.queryByText('Rizal Day')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument()
  })

  it("fills the year with the shift's country and says how many were added", async () => {
    const user = userEvent.setup()
    renderFor('PH')
    await screen.findByText('Rizal Day')

    await user.click(screen.getByRole('button', { name: `Fill in Philippines ${YEAR}` }))

    await waitFor(() =>
      expect(rpc.importHolidays).toHaveBeenCalledWith({ year: YEAR, country: 'PH' }),
    )
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: `Added 1 public holiday for ${YEAR}.` }),
      ),
    )
  })

  it('announces a refused fill and does not auto-dismiss it', async () => {
    rpc.importHolidays.mockRejectedValue(new Error('Only an admin sets the holiday calendar.'))
    const user = userEvent.setup()
    renderFor('PH')
    await screen.findByText('Rizal Day')

    await user.click(screen.getByRole('button', { name: `Fill in Philippines ${YEAR}` }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 'red',
          autoClose: false,
          message: 'Only an admin sets the holiday calendar.',
        }),
      ),
    )
  })

  it("adds a day off for the shift's country before the server answers", async () => {
    let resolve: (value: unknown) => void = () => {}
    rpc.saveHoliday.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const user = userEvent.setup()
    renderFor('PH')
    await screen.findByText('Rizal Day')

    const form = screen.getByRole('form', { name: 'Add a day off' })
    await user.type(within(form).getByLabelText(/Date/), `${YEAR}-08-21`)
    await user.type(within(form).getByLabelText(/Holiday/), 'Ninoy Aquino Day')
    await user.click(within(form).getByRole('button', { name: 'Add day off' }))

    expect(await screen.findByText('Ninoy Aquino Day')).toBeInTheDocument()
    expect(rpc.saveHoliday).toHaveBeenCalledWith({
      date: `${YEAR}-08-21`,
      name: 'Ninoy Aquino Day',
      country: 'PH',
    })
    resolve({ ...RIZAL, id: 'h-9' })
  })

  it('takes a refused day back off and says why under the date', async () => {
    rpc.saveHoliday.mockRejectedValue(new Error(`${YEAR}-12-30 is already Rizal Day.`))
    const user = userEvent.setup()
    renderFor('PH')
    await screen.findByText('Rizal Day')

    const form = screen.getByRole('form', { name: 'Add a day off' })
    await user.type(within(form).getByLabelText(/Date/), `${YEAR}-12-30`)
    await user.type(within(form).getByLabelText(/Holiday/), 'Rizal')
    await user.click(within(form).getByRole('button', { name: 'Add day off' }))

    expect(await within(form).findByText(`${YEAR}-12-30 is already Rizal Day.`)).toBeInTheDocument()
    expect(within(form).getByLabelText(/Holiday/)).toHaveValue('Rizal')
  })

  it('removes a day at once and only tells the server when undo is passed up', async () => {
    const user = userEvent.setup()
    renderFor('PH')

    await user.click(await screen.findByRole('button', { name: 'Remove Rizal Day' }))

    await waitFor(() => expect(screen.queryByText('Rizal Day')).not.toBeInTheDocument())
    expect(rpc.deleteHoliday).not.toHaveBeenCalled()

    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
    await waitFor(() => expect(rpc.deleteHoliday).toHaveBeenCalledWith('h-1'))
  })

  it('puts a removed day back on undo', async () => {
    const user = userEvent.setup()
    renderFor('PH')

    await user.click(await screen.findByRole('button', { name: 'Remove Rizal Day' }))
    await waitFor(() => expect(screen.queryByText('Rizal Day')).not.toBeInTheDocument())

    undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

    expect(await screen.findByText('Rizal Day')).toBeInTheDocument()
    expect(rpc.deleteHoliday).not.toHaveBeenCalled()
  })

  it('reads another year when asked', async () => {
    const user = userEvent.setup()
    renderFor('PH')
    await screen.findByText('Rizal Day')

    await user.click(screen.getByRole('combobox', { name: 'Year' }))
    await user.click(await screen.findByRole('option', { name: String(YEAR + 1) }))

    await waitFor(() => expect(rpc.listHolidays).toHaveBeenCalledWith(YEAR + 1))
  })

  it('has no axe violations', async () => {
    const { container } = renderFor('PH')
    await screen.findByText('Rizal Day')
    expect(await axe(container)).toHaveNoViolations()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { HolidaysPanel } from './holidays-panel'

const rpc = vi.hoisted(() => ({
  listHolidays: vi.fn(),
  saveHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn() }))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn(), UNDO_WINDOW_MS: 8000 }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@/lib/undo', () => undo)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/attendance/team',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const YEAR = new Date().getFullYear()
const CHRISTMAS = { id: 'h-1', date: `${YEAR}-12-25`, name: 'Christmas Day' }

describe('HolidaysPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    rpc.listHolidays.mockResolvedValue({ holidays: [CHRISTMAS], canManage: true })
    rpc.saveHoliday.mockResolvedValue({ id: 'h-2', date: `${YEAR}-01-01`, name: "New Year's Day" })
    rpc.deleteHoliday.mockResolvedValue(undefined)
  })

  it('lists the year on screen', async () => {
    render(<HolidaysPanel />)

    expect(await screen.findByText('Christmas Day')).toBeInTheDocument()
    expect(rpc.listHolidays).toHaveBeenCalledWith(YEAR)
  })

  it('reads the year from the URL', async () => {
    nav.search = `year=${YEAR + 1}`
    render(<HolidaysPanel />)

    await waitFor(() => expect(rpc.listHolidays).toHaveBeenCalledWith(YEAR + 1))
  })

  it('explains an empty year', async () => {
    rpc.listHolidays.mockResolvedValue({ holidays: [], canManage: true })
    render(<HolidaysPanel />)

    expect(await screen.findByText(`No holidays in ${YEAR}`)).toBeInTheDocument()
  })

  it('shows a new holiday before the server answers', async () => {
    let resolve: (value: unknown) => void = () => {}
    rpc.saveHoliday.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const user = userEvent.setup()
    render(<HolidaysPanel />)
    await screen.findByText('Christmas Day')

    const form = screen.getByRole('form', { name: 'Add a holiday' })
    await user.type(within(form).getByLabelText(/Date/), `${YEAR}-01-01`)
    await user.type(within(form).getByLabelText(/Holiday/), "New Year's Day")
    await user.click(within(form).getByRole('button', { name: 'Add holiday' }))

    expect(await screen.findByText("New Year's Day")).toBeInTheDocument()
    expect(rpc.saveHoliday).toHaveBeenCalledWith({ date: `${YEAR}-01-01`, name: "New Year's Day" })
    resolve({ id: 'h-2', date: `${YEAR}-01-01`, name: "New Year's Day" })
  })

  it('takes a refused holiday back off and says why under the date', async () => {
    rpc.saveHoliday.mockRejectedValue(new Error(`${YEAR}-12-25 is already Christmas Day.`))
    const user = userEvent.setup()
    render(<HolidaysPanel />)
    await screen.findByText('Christmas Day')

    const form = screen.getByRole('form', { name: 'Add a holiday' })
    await user.type(within(form).getByLabelText(/Date/), `${YEAR}-12-25`)
    await user.type(within(form).getByLabelText(/Holiday/), 'Xmas')
    await user.click(within(form).getByRole('button', { name: 'Add holiday' }))

    expect(
      await within(form).findByText(`${YEAR}-12-25 is already Christmas Day.`),
    ).toBeInTheDocument()
    expect(screen.queryByText('Xmas')).not.toBeInTheDocument()
    expect(within(form).getByLabelText(/Holiday/)).toHaveValue('Xmas')
    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }))
  })

  it('asks for a date and a name before adding', async () => {
    const user = userEvent.setup()
    render(<HolidaysPanel />)
    await screen.findByText('Christmas Day')

    await user.click(screen.getByRole('button', { name: 'Add holiday' }))

    expect(await screen.findByText('Use a date like 2026-09-22.')).toBeInTheDocument()
    expect(screen.getByText('Name the holiday.')).toBeInTheDocument()
    expect(rpc.saveHoliday).not.toHaveBeenCalled()
  })

  it('removes a holiday at once and only tells the server when undo is passed up', async () => {
    const user = userEvent.setup()
    render(<HolidaysPanel />)

    await user.click(await screen.findByRole('button', { name: 'Remove Christmas Day' }))

    await waitFor(() => expect(screen.queryByText('Christmas Day')).not.toBeInTheDocument())
    expect(rpc.deleteHoliday).not.toHaveBeenCalled()

    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
    await waitFor(() => expect(rpc.deleteHoliday).toHaveBeenCalledWith('h-1'))
  })

  it('puts a removed holiday back on undo', async () => {
    const user = userEvent.setup()
    render(<HolidaysPanel />)

    await user.click(await screen.findByRole('button', { name: 'Remove Christmas Day' }))
    await waitFor(() => expect(screen.queryByText('Christmas Day')).not.toBeInTheDocument())

    undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

    expect(await screen.findByText('Christmas Day')).toBeInTheDocument()
    expect(rpc.deleteHoliday).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = render(<HolidaysPanel />)
    await screen.findByText('Christmas Day')
    expect(await axe(container)).toHaveNoViolations()
  })
})

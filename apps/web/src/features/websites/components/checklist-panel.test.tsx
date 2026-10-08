import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { ChecklistPanel } from './checklist-panel'

const actions = vi.hoisted(() => ({
  loadChecklist: vi.fn(),
  runRound: vi.fn(),
  recordCheck: vi.fn(),
  listClientOptions: vi.fn(),
  createWebsite: vi.fn(),
  updateWebsite: vi.fn(),
  archiveWebsite: vi.fn(),
  restoreWebsite: vi.fn(),
  exportMonth: vi.fn(),
  saveItTeam: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/websites',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const TODAY = '2026-10-08'

const SITE = {
  id: 'site-1',
  name: 'Riverside site',
  url: 'https://riverside.example',
  clientId: 'client-1',
  clientName: 'Riverside Care Center',
  notes: '',
  checks: {
    clock_in: {
      status: 'up' as const,
      httpStatus: 200,
      responseMs: 310,
      error: '',
      note: '',
      checkedByName: 'Ada Lovelace',
      checkedAt: '2026-10-08T01:02:00.000Z',
    },
  },
}

const checklist = (websites: unknown[], date = TODAY) => ({
  ok: true,
  data: { date, today: TODAY, timeZone: 'UTC', websites },
})

beforeEach(() => {
  vi.clearAllMocks()
  nav.search = ''
  actions.loadChecklist.mockResolvedValue(checklist([SITE]))
  actions.listClientOptions.mockResolvedValue({
    ok: true,
    data: [{ id: 'client-1', name: 'Riverside Care Center' }],
  })
})

describe('ChecklistPanel', () => {
  it('shows each site with both rounds and lets the lead run a round', async () => {
    actions.runRound.mockResolvedValue(checklist([SITE]))
    const user = userEvent.setup()
    const { container } = render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const card = (await screen.findByRole('heading', { name: 'Riverside site' })).closest('li')
    if (!card) throw new Error('no card')
    expect(within(card).getByText('Running')).toBeInTheDocument()
    expect(within(card).getByText('HTTP 200 in 310 ms')).toBeInTheDocument()
    expect(within(card).getByText('Not checked yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run time out check' }))
    expect(actions.runRound).toHaveBeenCalledWith({ round: 'clock_out' })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('gives an IT member the list to read, without the controls', async () => {
    render(<ChecklistPanel canCheck={false} canManage={false} userName="Grace Hopper" />)

    await screen.findByRole('heading', { name: 'Riverside site' })
    expect(screen.queryByRole('button', { name: /Run time in check/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add website/ })).not.toBeInTheDocument()
    expect(screen.getByText(/The IT lead runs these checks/)).toBeInTheDocument()
  })

  it('keeps a past day read-only even for the lead', async () => {
    nav.search = 'date=2026-10-01'
    actions.loadChecklist.mockResolvedValue(checklist([SITE], '2026-10-01'))
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    await screen.findByRole('heading', { name: 'Riverside site' })
    expect(screen.queryByRole('button', { name: /Run time in check/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Past days are a record/)).toBeInTheDocument()
  })

  it('shows the lead’s verdict at once and puts it back, announced, when saving fails', async () => {
    let fail: (value: unknown) => void = () => undefined
    actions.recordCheck.mockReturnValue(new Promise((resolve) => (fail = resolve)))
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    await user.click(await screen.findByRole('button', { name: 'Mark Riverside site for time in' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: 'Issue' }))
    await user.type(within(dialog).getByLabelText('Note'), 'Booking form is blank')
    await user.click(within(dialog).getByRole('button', { name: 'Save check' }))

    expect(await screen.findByText('Booking form is blank')).toBeInTheDocument()
    expect(screen.getByText('Issue')).toBeInTheDocument()

    fail({ ok: false, message: 'Could not save the check — try again.' })

    await waitFor(() => expect(screen.queryByText('Booking form is blank')).not.toBeInTheDocument())
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Could not save the check — try again.' }),
    )
  })

  it('asks for a note before marking a site down', async () => {
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    await user.click(
      await screen.findByRole('button', { name: 'Mark Riverside site for time out' }),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: 'Down' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save check' }))

    expect(
      await within(dialog).findByText('Say what is wrong so the next person knows.'),
    ).toBeInTheDocument()
    expect(actions.recordCheck).not.toHaveBeenCalled()
  })

  it('invites adding the first site when the list is empty', async () => {
    actions.loadChecklist.mockResolvedValue(checklist([]))
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    expect(await screen.findByText('No websites yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add website' }).length).toBeGreaterThan(0)
  })

  it('says what went wrong and offers a retry when the list will not load', async () => {
    actions.loadChecklist.mockResolvedValue({ ok: false, message: 'The server is busy.' })
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('The server is busy.')
    actions.loadChecklist.mockResolvedValue(checklist([SITE]))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Riverside site' })).toBeInTheDocument()
  })
})

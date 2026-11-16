import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { ChecklistPanel } from './checklist-panel'

const actions = vi.hoisted(() => ({
  loadChecklist: vi.fn(),
  runRound: vi.fn(),
  recordCheck: vi.fn(),
  saveShiftCheck: vi.fn(),
  loadExpiry: vi.fn(),
  listClientOptions: vi.fn(),
  createWebsite: vi.fn(),
  updateWebsite: vi.fn(),
  archiveWebsite: vi.fn(),
  restoreWebsite: vi.fn(),
  exportMonth: vi.fn(),
  exportDayReport: vi.fn(),
  saveItTeam: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))
const download = vi.hoisted(() => ({ downloadFile: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))
vi.mock('@/lib/download', () => download)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/websites',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const TODAY = '2026-10-08'

const SITE = {
  id: 'site-1',
  name: 'Riverside site',
  url: 'https://www.riverside.example/',
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
  snapshots: {},
  shift: { pagesButtons: undefined, findings: '', action: '' },
  formEmail: undefined,
}

const checklist = (websites: unknown[], date = TODAY, snapshotsEnabled = true) => ({
  ok: true,
  data: { date, today: TODAY, timeZone: 'UTC', snapshotsEnabled, websites },
})

function panel() {
  return screen.getByRole('dialog', { name: 'Riverside site' })
}

beforeEach(() => {
  vi.clearAllMocks()
  nav.search = ''
  actions.loadChecklist.mockResolvedValue(checklist([SITE]))
  actions.loadExpiry.mockResolvedValue({
    ok: true,
    data: { domain: '2027-03-14T00:00:00.000Z', ssl: undefined },
  })
  actions.listClientOptions.mockResolvedValue({
    ok: true,
    data: [{ id: 'client-1', name: 'Riverside Care Center' }],
  })
})

describe('ChecklistPanel list', () => {
  it('shows every site as one row and lets the lead run a round', async () => {
    actions.runRound.mockResolvedValue(checklist([SITE]))
    const user = userEvent.setup()
    const { container } = render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const row = (await screen.findByRole('rowheader', { name: /Riverside site/ })).closest('tr')
    if (!row) throw new Error('no row')
    expect(within(row).getByText('riverside.example')).toBeInTheDocument()
    expect(within(row).getByText('Running')).toBeInTheDocument()
    expect(within(row).getByText('Not tested')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run time out check' }))
    expect(actions.runRound).toHaveBeenCalledWith({ round: 'clock_out' })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('opens a site’s panel through the URL', async () => {
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    await user.click(await screen.findByRole('button', { name: 'Riverside site, open details' }))

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/websites?site=site-1', { scroll: false }),
    )
  })

  it('gives an IT member the list to read, without the controls', async () => {
    render(<ChecklistPanel canCheck={false} canManage={false} userName="Grace Hopper" />)

    await screen.findByRole('rowheader', { name: /Riverside site/ })
    expect(screen.queryByRole('button', { name: /Run time in check/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add website/ })).not.toBeInTheDocument()
    expect(screen.getByText(/The IT lead runs these checks/)).toBeInTheDocument()
  })

  it('keeps a past day read-only even for the lead', async () => {
    nav.search = 'date=2026-10-01&site=site-1'
    actions.loadChecklist.mockResolvedValue(checklist([SITE], '2026-10-01'))
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    await screen.findByRole('dialog', { name: 'Riverside site' })
    expect(screen.queryByRole('button', { name: /Run time in check/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Past days are a record/)).toBeInTheDocument()
    expect(within(panel()).queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
    expect(within(panel()).getByLabelText('What you found')).toHaveAttribute('readonly')
  })

  it('downloads the day as a PDF report', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70])
    actions.exportDayReport.mockResolvedValue({
      ok: true,
      data: { fileName: `Daily-Website-Check-${TODAY}.pdf`, bytes },
    })
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck={false} canManage={false} userName="Grace Hopper" />)

    await user.click(await screen.findByRole('button', { name: 'Download PDF report' }))

    expect(actions.exportDayReport).toHaveBeenCalledWith({ date: TODAY })
    await waitFor(() =>
      expect(download.downloadFile).toHaveBeenCalledWith({
        fileName: `Daily-Website-Check-${TODAY}.pdf`,
        contentType: 'application/pdf',
        bytes,
      }),
    )
  })

  it('says why the report could not be made', async () => {
    actions.exportDayReport.mockResolvedValue({ ok: false, message: 'The server is busy.' })
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    await user.click(await screen.findByRole('button', { name: 'Download PDF report' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'The server is busy.' }),
      ),
    )
    expect(download.downloadFile).not.toHaveBeenCalled()
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
    expect(await screen.findByRole('rowheader', { name: /Riverside site/ })).toBeInTheDocument()
  })
})

describe('ChecklistPanel side panel', () => {
  beforeEach(() => {
    nav.search = 'site=site-1'
  })

  it('shows the automatic checks, the lead’s checks and the expiry dates', async () => {
    const { container } = render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const drawer = await screen.findByRole('dialog', { name: 'Riverside site' })
    expect(within(drawer).getByText(/HTTP 200 in 310 ms/)).toBeInTheDocument()
    expect(within(drawer).getByText('Not checked yet')).toBeInTheDocument()
    expect(within(drawer).getByText(/No snapshot for this check/)).toBeInTheDocument()
    expect(
      within(drawer).getByRole('group', { name: 'Pages and buttons for Riverside site' }),
    ).toBeInTheDocument()
    expect(await within(drawer).findByText(/Mar 14, 2027/)).toBeInTheDocument()
    expect(within(drawer).getByText('Not available')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('marks pages and buttons at once and puts it back, announced, when saving fails', async () => {
    let answer: (value: unknown) => void = () => undefined
    actions.saveShiftCheck.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const group = within(await screen.findByRole('dialog', { name: 'Riverside site' })).getByRole(
      'group',
      { name: 'Pages and buttons for Riverside site' },
    )
    await user.click(within(group).getByRole('button', { name: 'Fail' }))

    expect(actions.saveShiftCheck).toHaveBeenCalledWith({
      websiteId: 'site-1',
      pagesButtons: 'fail',
    })
    expect(within(group).getByRole('button', { name: 'Fail' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Say what failed under What you found.')).toBeInTheDocument()

    answer({ ok: false, message: 'Could not save — try again.' })

    await waitFor(() =>
      expect(within(group).getByRole('button', { name: 'Fail' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    )
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Could not save — try again.' }),
    )
  })

  it('records the form email once and offers a retest after', async () => {
    actions.saveShiftCheck.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const drawer = await screen.findByRole('dialog', { name: 'Riverside site' })
    expect(within(drawer).getByText('Tested once per site')).toBeInTheDocument()
    const group = within(drawer).getByRole('group', { name: 'Form email for Riverside site' })
    await user.click(within(group).getByRole('button', { name: 'Pass' }))

    expect(actions.saveShiftCheck).toHaveBeenCalledWith({ websiteId: 'site-1', formEmail: 'pass' })
    expect(within(drawer).getByText(/Pass · tested/)).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Test again' })).toBeInTheDocument()
  })

  it('saves what was found and what was done', async () => {
    actions.saveShiftCheck.mockResolvedValue({ ok: true, data: SITE })
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const drawer = await screen.findByRole('dialog', { name: 'Riverside site' })
    await user.type(within(drawer).getByLabelText('What you found'), 'Book button does nothing')
    await user.type(within(drawer).getByLabelText('What you did'), 'Ticket #4411')
    await user.click(within(drawer).getByRole('button', { name: 'Save findings' }))

    await waitFor(() =>
      expect(actions.saveShiftCheck).toHaveBeenCalledWith({
        websiteId: 'site-1',
        findings: 'Book button does nothing',
        action: 'Ticket #4411',
      }),
    )
  })

  it('shows a save failure next to the findings without losing them', async () => {
    actions.saveShiftCheck.mockResolvedValue({ ok: false, message: 'The server is busy.' })
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const drawer = await screen.findByRole('dialog', { name: 'Riverside site' })
    await user.type(within(drawer).getByLabelText('What you found'), 'Slow form')
    await user.click(within(drawer).getByRole('button', { name: 'Save findings' }))

    expect(await within(drawer).findByRole('alert')).toHaveTextContent('The server is busy.')
    expect(within(drawer).getByLabelText('What you found')).toHaveValue('Slow form')
  })

  it('lets the lead correct the checker, with a reason for anything but running', async () => {
    const user = userEvent.setup()
    render(<ChecklistPanel canCheck canManage userName="Ada Lovelace" />)

    const drawer = await screen.findByRole('dialog', { name: 'Riverside site' })
    const toggle = within(drawer).getByRole('button', { name: 'Checker is wrong? Change status' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(await within(drawer).findByRole('button', { name: 'Change time in status' }))

    const dialog = await screen.findByRole('dialog', { name: 'Riverside site · Time in' })
    await user.click(within(dialog).getByRole('radio', { name: 'Issue' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save status' }))

    expect(
      await within(dialog).findByText('Say what is wrong so the next person knows.'),
    ).toBeInTheDocument()
    expect(actions.recordCheck).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Reason'), 'Homepage is blank')
    await user.click(within(dialog).getByRole('button', { name: 'Save status' }))
    expect(actions.recordCheck).toHaveBeenCalledWith({
      websiteId: 'site-1',
      round: 'clock_in',
      status: 'issue',
      note: 'Homepage is blank',
    })
  })
})

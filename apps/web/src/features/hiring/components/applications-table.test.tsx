import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import { DEFAULT_APPLICATION_QUERY, type ApplicationSummary } from '../schema'
import { ApplicationsTable } from './applications-table'

const rpc = vi.hoisted(() => ({
  listApplications: vi.fn(),
  moveApplication: vi.fn(),
  rejectApplication: vi.fn(),
  reopenApplication: vi.fn(),
}))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn(), hide: vi.fn() } }))

const ROW: ApplicationSummary = {
  id: 'app-1',
  postingId: 'post-1',
  postingTitle: 'Registered nurse',
  fullName: 'Grace Hopper',
  email: 'grace@example.com',
  phone: '',
  status: 'active',
  stageId: 'screening',
  stageName: 'Screening',
  stageChangedAt: '2026-09-21T10:00:00.000Z',
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
  hasResume: true,
}

function pageOf(rows: ApplicationSummary[]) {
  return {
    rows,
    pageInfo: {
      page: 1,
      pageSize: 25,
      total: rows.length,
      pageCount: 1,
      hasPrevious: false,
      hasNext: false,
    },
  }
}

function renderTable() {
  return render(
    <ApplicationsTable
      query={DEFAULT_APPLICATION_QUERY}
      setQuery={vi.fn()}
      clearFilters={vi.fn()}
      rejectionMessage="Thanks."
    />,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('ApplicationsTable', () => {
  it('lists applicants across postings with the job and where each stands', async () => {
    rpc.listApplications.mockResolvedValue(pageOf([ROW]))
    const { container } = renderTable()

    const row = await screen.findByRole('row', { name: /Grace Hopper/ })
    expect(within(row).getByRole('link', { name: 'Registered nurse' })).toBeInTheDocument()
    expect(within(row).getByText('Screening')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('offers no stage moves without a posting’s stages, only the decision', async () => {
    rpc.listApplications.mockResolvedValue(pageOf([ROW]))
    const user = userEvent.setup()
    renderTable()

    await user.click(await screen.findByRole('button', { name: 'Actions for Grace Hopper' }))

    expect(await screen.findByRole('menuitem', { name: 'Not moving forward' })).toBeInTheDocument()
    expect(screen.queryByText('Move to')).not.toBeInTheDocument()
  })

  it('says why the list is empty', async () => {
    rpc.listApplications.mockResolvedValue(pageOf([]))
    renderTable()

    expect(await screen.findByText('Nobody in progress')).toBeInTheDocument()
  })
})

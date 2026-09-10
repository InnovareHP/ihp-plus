import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { RequestRow } from '../schema'
import { ApprovalsPanel } from './approvals-panel'

const rpc = vi.hoisted(() => ({
  listRequests: vi.fn(),
  decideRequest: vi.fn(),
  getRequest: vi.fn(),
  listAvailableForms: vi.fn(),
  listMyRequests: vi.fn(),
  withdrawRequest: vi.fn(),
  submitRequest: vi.fn(),
}))

const nav = vi.hoisted(() => ({ replace: vi.fn(), searchParams: new URLSearchParams() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => nav.searchParams,
  usePathname: () => '/requests/approvals',
}))

const PENDING: RequestRow = {
  id: 'req-1',
  formId: 'form-1',
  formName: 'Equipment request',
  fields: [
    { id: 'item', type: 'text', label: 'Item needed', help: '', required: true, options: [] },
  ],
  values: { item: 'Laptop' },
  requesterId: 'user-1',
  requesterName: 'Ada Lovelace',
  teamName: 'Information Technology',
  status: 'pending',
  decidedBy: undefined,
  decidedAt: undefined,
  decisionNote: undefined,
  createdAt: '2026-09-05T09:00:00Z',
  canDecide: true,
  isMine: false,
}

const MINE: RequestRow = {
  ...PENDING,
  id: 'req-2',
  requesterName: 'Grace Hopper',
  formName: 'Travel request',
  // Nobody decides their own request, whatever their role.
  canDecide: false,
  isMine: true,
}

function page(rows: RequestRow[]) {
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

const user = () => userEvent.setup()

describe('ApprovalsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.searchParams = new URLSearchParams()
    rpc.listRequests.mockResolvedValue(page([PENDING, MINE]))
    rpc.decideRequest.mockResolvedValue({ ...PENDING, status: 'approved', canDecide: false })
  })

  it('defaults to the pending queue rather than everything ever raised', async () => {
    render(<ApprovalsPanel />)

    await waitFor(() =>
      expect(rpc.listRequests).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' })),
    )
  })

  it('offers a decision only on rows the caller may decide', async () => {
    render(<ApprovalsPanel />)

    const theirs = await screen.findByRole('row', { name: /Ada Lovelace/ })
    expect(within(theirs).getByRole('button', { name: /Decide Ada Lovelace/ })).toBeInTheDocument()

    const mine = screen.getByRole('row', { name: /Grace Hopper/ })
    expect(within(mine).queryByRole('button', { name: /Decide/ })).not.toBeInTheDocument()
  })

  it('shows the answers inline without leaving the queue', async () => {
    const person = user()
    render(<ApprovalsPanel />)

    await person.click(await screen.findByRole('button', { name: /Show the answers on Ada/ }))

    expect(await screen.findByText('Laptop')).toBeInTheDocument()
  })

  it('will not reject without a reason, since the requester has to know what to change', async () => {
    const person = user()
    render(<ApprovalsPanel />)

    await person.click(await screen.findByRole('button', { name: /Decide Ada Lovelace/ }))
    await person.click(await screen.findByRole('button', { name: 'Reject request' }))

    expect(
      await screen.findByText('Say why it was rejected, so the requester knows what to change.'),
    ).toBeInTheDocument()
    expect(rpc.decideRequest).not.toHaveBeenCalled()
  })

  it('approves without a note and marks the row before the server answers', async () => {
    let resolve: (value: RequestRow) => void = () => {}
    rpc.decideRequest.mockReturnValue(
      new Promise<RequestRow>((settle) => {
        resolve = settle
      }),
    )
    const person = user()
    render(<ApprovalsPanel />)

    await person.click(await screen.findByRole('button', { name: /Decide Ada Lovelace/ }))
    await person.click(await screen.findByRole('button', { name: 'Approve request' }))

    await waitFor(() =>
      expect(rpc.decideRequest).toHaveBeenCalledWith({
        submissionId: 'req-1',
        decision: 'approved',
        note: '',
      }),
    )
    // Optimistic: the row already reads Approved while the call is in flight. Scoped to the
    // table because the status tabs carry the same words.
    const table = screen.getByRole('table', { name: 'Requests' })
    await waitFor(() => expect(within(table).getByText('Approved')).toBeInTheDocument())
    resolve({ ...PENDING, status: 'approved', canDecide: false })
  })

  it('rolls the row back and announces it when the decision is refused', async () => {
    rpc.decideRequest.mockRejectedValue(new Error('This request has already been decided.'))
    const person = user()
    render(<ApprovalsPanel />)

    await person.click(await screen.findByRole('button', { name: /Decide Ada Lovelace/ }))
    await person.click(await screen.findByRole('button', { name: 'Approve request' }))

    await waitFor(() => expect(rpc.decideRequest).toHaveBeenCalled())
    const table = screen.getByRole('table', { name: 'Requests' })
    await waitFor(() => expect(within(table).getAllByText('Pending').length).toBe(2))
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'red',
        autoClose: false,
        message: 'This request has already been decided.',
      }),
    )
  })

  it('puts the search in the URL rather than local state', async () => {
    const person = user()
    render(<ApprovalsPanel />)

    await person.type(await screen.findByLabelText('Search requests'), 'equip')

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/requests/approvals?q=equip', { scroll: false }),
    )
  })

  it('explains an empty queue instead of showing bare headings', async () => {
    rpc.listRequests.mockResolvedValue(page([]))
    render(<ApprovalsPanel />)

    expect(await screen.findByText('Nothing waiting on you')).toBeInTheDocument()
  })

  it('offers a retry when the queue cannot load', async () => {
    rpc.listRequests.mockRejectedValue(new Error('You do not have permission.'))
    render(<ApprovalsPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ApprovalsPanel />)
    await screen.findByText('Ada Lovelace', { exact: false })
    expect(await axe(container)).toHaveNoViolations()
  })
})

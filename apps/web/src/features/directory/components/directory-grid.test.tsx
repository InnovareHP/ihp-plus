import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { DirectoryGrid } from './directory-grid'

const rpc = vi.hoisted(() => ({ listPeople: vi.fn(), listDepartments: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/directory',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const ADA = {
  userId: 'user-1',
  name: 'Ada Lovelace',
  jobTitle: 'Software Engineer',
  department: 'Information Technology',
  email: 'ada@innovarehp.com',
  phone: '(609) 555-0134',
  ihpId: 'IHP-0001',
  employmentType: 'Full-time',
  photoUrl: 'https://files.example/ada.jpg',
  startDate: '2026-03-04T00:00:00.000Z',
  isLead: false,
}

const ONE_PAGE = {
  page: 1,
  pageSize: 25,
  total: 1,
  pageCount: 1,
  hasPrevious: false,
  hasNext: false,
}

const page = (rows: unknown[], pageInfo: Partial<typeof ONE_PAGE> = {}) => ({
  rows,
  pageInfo: { ...ONE_PAGE, ...pageInfo },
})

const user = () => userEvent.setup()

describe('DirectoryGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    rpc.listPeople.mockResolvedValue(page([ADA]))
    rpc.listDepartments.mockResolvedValue({
      departments: [{ teamId: 'team-1', name: 'Care Management', memberCount: 4 }],
      unassignedCount: 2,
    })
  })

  it('shows a colleague with their role, department and how to reach them', async () => {
    render(<DirectoryGrid />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    const card = within(screen.getByRole('article'))
    expect(card.getByText('Software Engineer')).toBeInTheDocument()
    expect(card.getByText('Information Technology')).toBeInTheDocument()
    expect(card.getByText('IHP-0001')).toBeInTheDocument()
    // A directory is for getting in touch, so the contacts are links.
    expect(card.getByRole('link', { name: 'ada@innovarehp.com' })).toHaveAttribute(
      'href',
      'mailto:ada@innovarehp.com',
    )
    expect(card.getByRole('link', { name: '(609) 555-0134' })).toHaveAttribute(
      'href',
      'tel:6095550134',
    )
  })

  it('marks a department lead', async () => {
    rpc.listPeople.mockResolvedValue(page([{ ...ADA, isLead: true }]))
    render(<DirectoryGrid />)

    expect(await screen.findByText('Lead')).toBeInTheDocument()
  })

  it('says what is missing rather than leaving a card half blank', async () => {
    rpc.listPeople.mockResolvedValue(
      page([{ ...ADA, jobTitle: '', department: '', phone: '', ihpId: '', photoUrl: '' }]),
    )
    render(<DirectoryGrid />)

    const card = within(await screen.findByRole('article'))
    expect(card.getByText('No job title')).toBeInTheDocument()
    expect(card.getByText('No department')).toBeInTheDocument()
    expect(card.getByText('No phone')).toBeInTheDocument()
  })

  it('asks the server for the search and department the URL carries', async () => {
    nav.search = 'search=ada&teamIds=team-1&page=2'
    render(<DirectoryGrid />)

    await screen.findByText('Ada Lovelace')
    expect(rpc.listPeople).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ada', teamIds: ['team-1'], page: 2 }),
    )
  })

  it('offers the departments plus the people who have none', async () => {
    const person = user()
    render(<DirectoryGrid />)
    await screen.findByText('Ada Lovelace')

    await person.click(screen.getByRole('button', { name: /Filters/ }))

    const drawer = within(await screen.findByRole('dialog', { name: 'Filter the directory' }))
    await person.click(drawer.getByRole('combobox', { name: 'Department' }))
    expect(screen.getByRole('option', { name: 'Care Management (4)' })).toBeInTheDocument()
    // Someone with no department is offered as a filter rather than hidden.
    expect(screen.getByRole('option', { name: 'No department (2)' })).toBeInTheDocument()
  })

  it('pages through the company from the footer', async () => {
    rpc.listPeople.mockResolvedValue(page([ADA], { total: 60, pageCount: 3, hasNext: true }))
    const person = user()
    render(<DirectoryGrid />)

    expect(await screen.findByText('Showing 1–25 of 60')).toBeInTheDocument()
    await person.click(screen.getByRole('button', { name: 'Page 2' }))

    expect(nav.replace).toHaveBeenCalledWith('/directory?page=2', { scroll: false })
  })

  it('separates a filtered dead end from an empty company', async () => {
    rpc.listPeople.mockResolvedValue(page([], { total: 0 }))
    render(<DirectoryGrid />)
    expect(await screen.findByText('Nobody has finished onboarding yet')).toBeInTheDocument()

    nav.search = 'search=nobody'
    render(<DirectoryGrid />)
    expect(await screen.findByText('Nobody matches these filters')).toBeInTheDocument()
  })

  it('offers a retry when the directory cannot load', async () => {
    rpc.listPeople.mockRejectedValue(new Error('You lost connection.'))
    render(<DirectoryGrid />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You lost connection.')
    await user().click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rpc.listPeople.mock.calls.length).toBeGreaterThan(1))
  })

  it('has no axe violations', async () => {
    const { container } = render(<DirectoryGrid />)
    await screen.findByText('Ada Lovelace')

    expect(await axe(container)).toHaveNoViolations()
  })
})

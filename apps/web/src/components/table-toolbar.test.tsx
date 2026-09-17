import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { TableToolbar, type FilterControl } from './table-toolbar'

const setQuery = vi.fn()
const clearFilters = vi.fn()

const FILTERS: readonly FilterControl[] = [
  {
    kind: 'multi',
    key: 'teamIds',
    label: 'Department',
    options: [
      { value: 'team-1', label: 'Finance' },
      { value: 'team-2', label: 'Executive' },
    ],
  },
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'suspended', label: 'Suspended' },
    ],
  },
  { kind: 'toggle', key: 'emptyOnly', label: 'Only empty departments' },
  { kind: 'dateRange', fromKey: 'from', toKey: 'to', label: 'Start date' },
]

const EMPTY = { search: '', teamIds: [], status: '', emptyOnly: false, from: '', to: '' }

const user = () => userEvent.setup()

function renderToolbar(query: Record<string, unknown> = EMPTY) {
  return render(
    <TableToolbar
      label="departments"
      query={query}
      setQuery={setQuery}
      clearFilters={clearFilters}
      filters={FILTERS}
    />,
  )
}

describe('TableToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debounces what is typed into the search box into the query', async () => {
    const person = user()
    renderToolbar()

    await person.type(screen.getByRole('searchbox', { name: 'Search departments' }), 'fin')

    await waitFor(() => expect(setQuery).toHaveBeenCalledWith({ search: 'fin' }))
  })

  it('keeps the advanced filters behind a drawer rather than on the page', async () => {
    const person = user()
    renderToolbar()

    expect(screen.queryByRole('textbox', { name: 'Department' })).not.toBeInTheDocument()

    await person.click(screen.getByRole('button', { name: /^Filters/ }))

    expect(await screen.findByText('Filter departments')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Only empty departments' })).toBeInTheDocument()
    expect(screen.getByLabelText('Start date, from')).toBeInTheDocument()
  })

  it('applies a choice from the drawer to the query', async () => {
    const person = user()
    renderToolbar()

    await person.click(screen.getByRole('button', { name: /^Filters/ }))
    await person.click(await screen.findByRole('switch', { name: 'Only empty departments' }))

    expect(setQuery).toHaveBeenCalledWith({ emptyOnly: true })
  })

  it('shows one chip per applied value, with the option label rather than its id', () => {
    renderToolbar({ ...EMPTY, teamIds: ['team-1', 'team-2'], status: 'active' })

    expect(screen.getByText('Finance')).toBeInTheDocument()
    expect(screen.getByText('Executive')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('removes a single value from a chip without clearing the rest', async () => {
    const person = user()
    renderToolbar({ ...EMPTY, teamIds: ['team-1', 'team-2'] })

    await person.click(screen.getByRole('button', { name: 'Remove the Finance filter' }))

    expect(setQuery).toHaveBeenCalledWith({ teamIds: ['team-2'] })
  })

  it('describes a date range as one chip that clears both ends', async () => {
    const person = user()
    renderToolbar({ ...EMPTY, from: '2026-01-01', to: '2026-06-30' })

    expect(screen.getByText('Start date 2026-01-01 to 2026-06-30')).toBeInTheDocument()

    await person.click(
      screen.getByRole('button', { name: 'Remove the Start date 2026-01-01 to 2026-06-30 filter' }),
    )

    expect(setQuery).toHaveBeenCalledWith({ from: '', to: '' })
  })

  it('offers no chips and no clearing when nothing is applied', () => {
    renderToolbar()

    expect(screen.queryByText('Filtered by')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()
  })

  it('clears everything at once', async () => {
    const person = user()
    renderToolbar({ ...EMPTY, status: 'active' })

    await person.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(clearFilters).toHaveBeenCalled()
  })

  it('has no axe violations with filters applied', async () => {
    const { container } = renderToolbar({ ...EMPTY, teamIds: ['team-1'] })
    expect(await axe(container)).toHaveNoViolations()
  })
})

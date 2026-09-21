import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import { DataTable, type DataTableColumn } from './data-table'

interface Lead {
  id: string
  name: string
  city: string
}

const LEADS: Lead[] = [
  { id: 'lead-1', name: 'Acme Corp', city: 'Trenton' },
  { id: 'lead-2', name: 'Globex', city: 'Newark' },
]

const COLUMNS: DataTableColumn<Lead>[] = [
  { key: 'name', header: 'Name', rowHeader: true, sortable: true, render: (row) => row.name },
  { key: 'city', header: 'City', render: (row) => row.city },
]

function renderTable(props: Partial<Parameters<typeof DataTable<Lead>>[0]> = {}) {
  return render(
    <DataTable
      label="Leads"
      columns={COLUMNS}
      rows={LEADS}
      rowKey={(row) => row.id}
      isPending={false}
      empty="Add your first lead to start tracking follow-ups."
      {...props}
    />,
  )
}

describe('DataTable', () => {
  it('renders a real table with a header per column and the row header cell', () => {
    renderTable()

    const table = screen.getByRole('table', { name: 'Leads' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Name', 'City'])
    // The rowHeader column is a th, so screen readers name each row by it.
    expect(within(table).getByRole('rowheader', { name: /Acme Corp/ })).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('shows a skeleton with the table hidden while the data is pending', () => {
    renderTable({ isPending: true, rows: undefined })

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/Loading leads/)).toBeInTheDocument()
  })

  it('explains an error and retries on demand', async () => {
    const onRetry = vi.fn()
    renderTable({
      isError: true,
      rows: undefined,
      error: new Error('You lost connection.'),
      onRetry,
    })

    expect(screen.getByRole('alert')).toHaveTextContent('You lost connection.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows the empty copy instead of a bare table when there are no rows', () => {
    renderTable({ rows: [] })

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/Add your first lead/)).toBeInTheDocument()
  })

  it('dims but keeps the rows during a background refetch', () => {
    renderTable({ isFetching: true })

    const table = screen.getByRole('table', { name: 'Leads' })
    expect(table).toHaveAttribute('aria-busy', 'true')
    expect(within(table).getByRole('rowheader', { name: /Acme Corp/ })).toBeInTheDocument()
  })

  it('reports the sort state and asks for the opposite direction on the sorted column', async () => {
    const onSortChange = vi.fn()
    renderTable({ sort: { key: 'name', direction: 'asc' }, onSortChange })

    const [nameHeader, cityHeader] = screen.getAllByRole('columnheader')
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    // A column without `sortable` carries no aria-sort at all.
    expect(cityHeader).not.toHaveAttribute('aria-sort')

    await userEvent.setup().click(screen.getByRole('button', { name: /Sort by Name, descending/ }))
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
  })

  it('sorts from the keyboard on an unsorted column', async () => {
    const onSortChange = vi.fn()
    renderTable({ onSortChange })

    expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'none')
    const person = userEvent.setup()
    await person.tab()
    expect(screen.getByRole('button', { name: /Sort by Name, ascending/ })).toHaveFocus()
    await person.keyboard('{Enter}')
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
  })

  it('shows a filtered dead end separately from an empty list', () => {
    renderTable({
      rows: [],
      isFiltered: true,
      noResults: <p>No lead matches these filters.</p>,
    })

    expect(screen.getByText('No lead matches these filters.')).toBeInTheDocument()
    expect(screen.queryByText(/Add your first lead/)).not.toBeInTheDocument()
  })

  it('counts the rows of the page and moves between pages', async () => {
    const onPageChange = vi.fn()
    renderTable({
      pageInfo: {
        page: 2,
        pageSize: 25,
        total: 214,
        pageCount: 9,
        hasPrevious: true,
        hasNext: true,
      },
      onPageChange,
    })

    expect(screen.getByText('Showing 26–50 of 214')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Page 3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('keeps the count but drops the pager when everything fits on one page', () => {
    renderTable({
      pageInfo: {
        page: 1,
        pageSize: 25,
        total: 2,
        pageCount: 1,
        hasPrevious: false,
        hasNext: false,
      },
      onPageChange: vi.fn(),
    })

    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('changes the rows per page from the footer', async () => {
    const onPageSizeChange = vi.fn()
    renderTable({
      pageInfo: {
        page: 1,
        pageSize: 25,
        total: 214,
        pageCount: 9,
        hasPrevious: false,
        hasNext: true,
      },
      onPageChange: vi.fn(),
      onPageSizeChange,
    })

    const person = userEvent.setup()
    await person.click(screen.getByRole('combobox', { name: 'Rows per page of leads' }))
    await person.click(await screen.findByRole('option', { name: '50 per page' }))

    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('hides the rows-per-page control while everything fits in the smallest page', () => {
    renderTable({
      pageInfo: {
        page: 1,
        pageSize: 25,
        total: 2,
        pageCount: 1,
        hasPrevious: false,
        hasNext: false,
      },
      onPageChange: vi.fn(),
      onPageSizeChange: vi.fn(),
    })

    expect(screen.queryByRole('combobox', { name: /Rows per page/ })).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderTable({
      sort: { key: 'name', direction: 'asc' },
      onSortChange: vi.fn(),
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/render'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { useClientPagination } from './use-client-pagination'

const router = vi.hoisted(() => ({ replace: vi.fn() }))
const params = vi.hoisted(() => ({ value: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/departments',
  useSearchParams: () => params.value,
  useRouter: () => router,
}))

interface Row {
  id: string
  name: string
}

const ROWS: Row[] = Array.from({ length: 12 }, (_, index) => ({
  id: `row-${index + 1}`,
  name: `Department ${index + 1}`,
}))

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', rowHeader: true, render: (row) => row.name },
]

function Table({ rows }: { rows: Row[] | undefined }) {
  const paged = useClientPagination(rows, { pageSize: 10 })

  return (
    <DataTable
      label="Departments"
      columns={COLUMNS}
      rows={paged.rows}
      rowKey={(row) => row.id}
      isPending={rows === undefined}
      pageInfo={paged.pageInfo}
      onPageChange={paged.onPageChange}
      onPageSizeChange={paged.onPageSizeChange}
      empty="Add the first department."
    />
  )
}

describe('useClientPagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    params.value = new URLSearchParams()
  })

  it('shows only the first page and counts the whole list', () => {
    render(<Table rows={ROWS} />)

    expect(screen.getByText('Department 10')).toBeInTheDocument()
    expect(screen.queryByText('Department 11')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument()
  })

  it('puts the page in the URL rather than in component state', async () => {
    render(<Table rows={ROWS} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Page 2' }))

    expect(router.replace).toHaveBeenCalledWith('/departments?page=2', { scroll: false })
  })

  it('reads the page back out of the URL', () => {
    params.value = new URLSearchParams('page=2')
    render(<Table rows={ROWS} />)

    expect(screen.getByText('Department 11')).toBeInTheDocument()
    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument()
  })

  it('starts the reader over when the page size changes', async () => {
    params.value = new URLSearchParams('page=2')
    render(<Table rows={ROWS} />)

    const person = userEvent.setup()
    await person.click(screen.getByRole('combobox', { name: 'Rows per page of departments' }))
    await person.click(await screen.findByRole('option', { name: '25 per page' }))

    expect(router.replace).toHaveBeenCalledWith('/departments?page=1&pageSize=25', {
      scroll: false,
    })
  })

  it('clamps a page past the end rather than showing an empty table', () => {
    params.value = new URLSearchParams('page=9')
    render(<Table rows={ROWS} />)

    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument()
  })

  it('leaves the table pending while the list has not arrived', () => {
    render(<Table rows={undefined} />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  })
})

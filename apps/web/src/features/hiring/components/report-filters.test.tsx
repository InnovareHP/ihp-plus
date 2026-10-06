import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { ReportFilters } from './report-filters'

const router = vi.hoisted(() => ({ replace: vi.fn() }))
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/hiring/reports',
  useRouter: () => router,
  useSearchParams: () => search.params,
}))

const POSTINGS = [
  { value: 'post-1', label: 'Registered nurse' },
  { value: 'post-2', label: 'Care coordinator' },
]

beforeEach(() => {
  vi.clearAllMocks()
  search.params = new URLSearchParams()
})

describe('ReportFilters', () => {
  it('shows the default period and every posting', async () => {
    const { container } = render(<ReportFilters postingOptions={POSTINGS} />)

    expect(screen.getByRole('combobox', { name: 'Applied in' })).toHaveValue('Last 90 days')
    expect(screen.getByRole('combobox', { name: 'Posting' })).toHaveValue('')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('writes a new period into the URL', async () => {
    const user = userEvent.setup()
    render(<ReportFilters postingOptions={POSTINGS} />)

    await user.click(screen.getByRole('combobox', { name: 'Applied in' }))
    await user.click(screen.getByRole('option', { name: 'Last 12 months' }))
    expect(router.replace).toHaveBeenLastCalledWith('/hiring/reports?period=12m', {
      scroll: false,
    })
  })

  it('narrows to one posting and keeps the chosen period', async () => {
    search.params = new URLSearchParams('period=all')
    const user = userEvent.setup()
    render(<ReportFilters postingOptions={POSTINGS} />)

    await user.click(screen.getByRole('combobox', { name: 'Posting' }))
    await user.click(screen.getByRole('option', { name: 'Care coordinator' }))
    expect(router.replace).toHaveBeenLastCalledWith('/hiring/reports?period=all&postingId=post-2', {
      scroll: false,
    })
  })
})

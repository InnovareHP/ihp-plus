import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { ExportMonthForm } from './export-month-form'

const WEBSITES = [
  { id: 'site-1', name: 'Riverside site', removed: false },
  { id: 'site-2', name: 'Old clinic site', removed: true },
]

describe('ExportMonthForm', () => {
  it('downloads every website by default', async () => {
    const onExport = vi.fn(async () => undefined)
    const user = userEvent.setup()
    const { container } = render(
      <ExportMonthForm
        thisMonth="2026-10"
        websites={WEBSITES}
        websitesLoading={false}
        onExport={onExport}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Download CSV' }))

    expect(onExport).toHaveBeenCalledWith({ month: '2026-10', websiteId: '' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('narrows the file to one website, removed ones included', async () => {
    const onExport = vi.fn(async () => undefined)
    const user = userEvent.setup()
    render(
      <ExportMonthForm
        thisMonth="2026-10"
        websites={WEBSITES}
        websitesLoading={false}
        onExport={onExport}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Website' }))
    await user.click(await screen.findByRole('option', { name: 'Old clinic site (removed)' }))
    await user.click(screen.getByRole('button', { name: 'Download CSV' }))

    expect(onExport).toHaveBeenCalledWith({ month: '2026-10', websiteId: 'site-2' })
  })

  it('shows why the file could not be built next to the month', async () => {
    const onExport = vi.fn(async () => {
      throw new Error('That month has not started yet.')
    })
    const user = userEvent.setup()
    render(
      <ExportMonthForm
        thisMonth="2026-10"
        websites={[]}
        websitesLoading={false}
        onExport={onExport}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Download CSV' }))

    expect(await screen.findByText('That month has not started yet.')).toBeInTheDocument()
  })
})

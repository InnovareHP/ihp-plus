import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { REPORT_SITES } from '../sites'
import { AllReportsSection } from './all-reports-section'

const RANGE = { start: '2026-10-25', end: '2026-11-24' }

describe('AllReportsSection', () => {
  it('counts the takeaways written and names the reports still without them', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    const done = REPORT_SITES.slice(2).map((site) => site.key)
    const { container } = render(
      <AllReportsSection
        range={RANGE}
        withTakeaways={done}
        downloading={false}
        failed={[]}
        onDownload={onDownload}
      />,
    )

    expect(screen.getByText('Takeaways saved for 12 of 14 websites.')).toBeInTheDocument()
    expect(screen.getByText('Palm Grove')).toBeInTheDocument()
    expect(screen.getByText('Magnolia')).toBeInTheDocument()
    expect(screen.getByText(/Oct 25 – Nov 24, 2026/)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: 'Download all 14 reports' }))
    expect(onDownload).toHaveBeenCalled()
  })

  it('names the sites the last zip had to leave out', () => {
    render(
      <AllReportsSection
        range={RANGE}
        withTakeaways={REPORT_SITES.map((site) => site.key)}
        downloading={false}
        failed={[
          { site: 'Palm Grove', message: 'Could not read Palm Grove from Google Analytics.' },
        ]}
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText('Takeaways saved for 14 of 14 websites.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not read Palm Grove')
  })
})

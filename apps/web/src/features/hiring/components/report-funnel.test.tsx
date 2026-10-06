import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import { ReportFunnel } from './report-funnel'

describe('ReportFunnel', () => {
  it('lists each stage with its count and share of applicants', async () => {
    const { container } = render(
      <ReportFunnel
        applications={4}
        steps={[
          { name: 'Applied', reached: 4 },
          { name: 'Interview', reached: 1 },
          { name: 'Hired', reached: 0 },
        ]}
      />,
    )

    expect(
      screen.getByRole('table', { name: 'Applicants reaching each stage' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Interview' })).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Interview: 25% of applicants' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Hired: 0% of applicants' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})

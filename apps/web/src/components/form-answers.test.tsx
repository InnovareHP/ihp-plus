import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import type { FormField } from '@/features/requests/schema'
import { FormAnswers } from './form-answers'

const RECEIPT: FormField = {
  id: 'receipt',
  type: 'file',
  label: 'Receipt',
  help: '',
  placeholder: '',
  required: true,
  options: [],
}

describe('FormAnswers', () => {
  it('links a file answer to its download by the file name', async () => {
    const { container } = render(
      <FormAnswers
        fields={[RECEIPT]}
        values={{ receipt: 'lunch.pdf' }}
        fileHref={(fieldId) => `/app/api/requests/req-1/files/${fieldId}`}
      />,
    )

    expect(screen.getByRole('link', { name: 'lunch.pdf' })).toHaveAttribute(
      'href',
      '/app/api/requests/req-1/files/receipt',
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows the file name as text where no download is offered', () => {
    render(<FormAnswers fields={[RECEIPT]} values={{ receipt: 'lunch.pdf' }} />)

    expect(screen.getByText('lunch.pdf')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('says a skipped file was not answered', () => {
    render(
      <FormAnswers fields={[{ ...RECEIPT, required: false }]} values={{}} fileHref={() => '#'} />,
    )

    expect(screen.getByText('Not answered')).toBeInTheDocument()
  })
})

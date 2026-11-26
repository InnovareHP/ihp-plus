import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { EMPTY_TAKEAWAYS, type TakeawaysValues } from '../schema'
import { TakeawaysForm, type TakeawaysFormProps } from './takeaways-form'

const SAVED: TakeawaysValues = {
  observations: 'Traffic volume: 1,975 page views.',
  strengths: 'Fast pages: 0.17 MB per page view.',
  improvements: 'Search footprint: 34 page views from google.com.',
  recommendations: 'Grow search: add service pages.',
}

function renderForm(props: Partial<TakeawaysFormProps> = {}) {
  const onSave = vi.fn(async () => null as string | null)
  const view = render(
    <TakeawaysForm initial={EMPTY_TAKEAWAYS} savedAt={null} onSave={onSave} {...props} />,
  )
  return { onSave, ...view }
}

const field = (name: string) => screen.getByRole('textbox', { name })

describe('TakeawaysForm', () => {
  it('opens on the saved takeaways and saves the admin’s edits', async () => {
    const user = userEvent.setup()
    const { onSave, container } = renderForm({
      initial: SAVED,
      savedAt: '2026-11-26T10:00:00Z',
    })

    expect(field('Key observations')).toHaveValue(SAVED.observations)
    expect(screen.getByText(/^Saved Nov 26/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /with AI/ })).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    await user.type(field('Strengths'), ' Steady.')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save takeaways' }))
    expect(onSave).toHaveBeenCalledWith({ ...SAVED, strengths: `${SAVED.strengths} Steady.` })
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument())
  })

  it('keeps the typed text and says why when saving fails', async () => {
    const user = userEvent.setup()
    renderForm({
      onSave: vi.fn(async () => 'Could not save the takeaways. Try again in a minute.'),
    })

    expect(screen.getByText('Not saved yet')).toBeInTheDocument()
    await user.type(field('Key observations'), 'Steady month')
    await user.click(screen.getByRole('button', { name: 'Save takeaways' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the takeaways.')
    expect(field('Key observations')).toHaveValue('Steady month')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('names a section that is too long', async () => {
    const user = userEvent.setup()
    const { onSave } = renderForm({
      initial: { ...EMPTY_TAKEAWAYS, strengths: 'x'.repeat(4001) },
    })

    await user.click(screen.getByRole('button', { name: 'Save takeaways' }))

    expect(await screen.findByText('Keep this section under 4,000 characters.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

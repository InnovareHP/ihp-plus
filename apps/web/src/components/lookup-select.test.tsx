import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { LookupSelect } from './lookup-select'

const listOptions = vi.hoisted(() => vi.fn())

vi.mock('@/rpc/browser', () => ({ browserClients: { lookups: { listOptions } } }))

function options(...values: string[]) {
  return { options: values.map((value, index) => ({ value, sortOrder: index })) }
}

const user = () => userEvent.setup()

function renderSelect(value: string | null = null) {
  return render(
    <LookupSelect
      kind="position"
      label="Current position"
      placeholder="Choose a position"
      value={value}
      onChange={vi.fn()}
    />,
  )
}

describe('LookupSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listOptions.mockResolvedValue(options('Registered Nurse', 'Physician'))
  })

  it('fetches nothing when the page renders', () => {
    renderSelect()

    expect(screen.getByRole('combobox', { name: /Current position/ })).toBeInTheDocument()
    expect(listOptions).not.toHaveBeenCalled()
  })

  it('fetches on hover, before the dropdown is ever opened', async () => {
    const person = user()
    renderSelect()

    await person.hover(screen.getByRole('combobox', { name: /Current position/ }))

    await waitFor(() => expect(listOptions).toHaveBeenCalledWith({ kind: 'position' }))
  })

  it('fetches on open for anyone who never hovered', async () => {
    const person = user()
    renderSelect()

    await person.click(screen.getByRole('combobox', { name: /Current position/ }))

    await waitFor(() => expect(listOptions).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('option', { name: 'Registered Nurse' })).toBeInTheDocument()
  })

  it('pays for the list once, however many times it is reopened', async () => {
    const person = user()
    renderSelect()

    const control = screen.getByRole('combobox', { name: /Current position/ })
    await person.hover(control)
    await waitFor(() => expect(listOptions).toHaveBeenCalledTimes(1))

    await person.click(control)
    await person.click(await screen.findByRole('option', { name: 'Physician' }))
    await person.click(control)

    expect(listOptions).toHaveBeenCalledTimes(1)
  })

  it('shows a saved answer before anything is fetched', () => {
    renderSelect('Registered Nurse')

    expect(screen.getByRole('combobox', { name: /Current position/ })).toHaveValue(
      'Registered Nurse',
    )
    expect(listOptions).not.toHaveBeenCalled()
  })

  it('keeps showing a value that has since been retired from the list', async () => {
    const person = user()
    renderSelect('Chief Vibes Officer')

    await person.click(screen.getByRole('combobox', { name: /Current position/ }))

    await waitFor(() => expect(listOptions).toHaveBeenCalled())
    expect(screen.getByRole('combobox', { name: /Current position/ })).toHaveValue(
      'Chief Vibes Officer',
    )
    expect(await screen.findByRole('option', { name: 'Chief Vibes Officer' })).toBeInTheDocument()
  })

  it('says so when the list cannot be loaded', async () => {
    listOptions.mockRejectedValue(new Error('Sign in to continue.'))
    const person = user()
    renderSelect()

    await person.click(screen.getByRole('combobox', { name: /Current position/ }))

    expect(await screen.findByText('Sign in to continue.')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderSelect()
    expect(await axe(container)).toHaveNoViolations()
  })
})

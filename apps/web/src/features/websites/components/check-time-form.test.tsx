import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { CheckTimeForm } from './check-time-form'

describe('CheckTimeForm', () => {
  it('saves the typed time and closes', async () => {
    const onSave = vi.fn(async () => undefined)
    const onClose = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <CheckTimeForm defaults={{ time: '20:05' }} onSave={onSave} onClose={onClose} />,
    )

    const input = screen.getByLabelText(/Checked at/)
    expect(input).toBeRequired()
    await user.clear(input)
    await user.type(input, '21:40')
    await user.click(screen.getByRole('button', { name: 'Save time' }))

    expect(onSave).toHaveBeenCalledWith({ time: '21:40' })
    expect(onClose).toHaveBeenCalled()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('asks for a time when the field is empty', async () => {
    const onSave = vi.fn(async () => undefined)
    const user = userEvent.setup()
    render(<CheckTimeForm defaults={{ time: '20:05' }} onSave={onSave} onClose={vi.fn()} />)

    await user.clear(screen.getByLabelText(/Checked at/))
    await user.click(screen.getByRole('button', { name: 'Save time' }))

    expect(await screen.findByText('Enter the time the check ran.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Checked at/)).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('announces a server refusal and stays open', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <CheckTimeForm
        defaults={{ time: '20:05' }}
        onSave={async () => {
          throw new Error('That time has not happened yet. Pick a time that has passed.')
        }}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save time' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That time has not happened yet.')
    expect(onClose).not.toHaveBeenCalled()
  })
})

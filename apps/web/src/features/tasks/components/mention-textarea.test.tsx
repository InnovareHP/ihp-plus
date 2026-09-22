import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { MentionTextarea } from './mention-textarea'

const COLLEAGUES = [
  { userId: 'user-1', name: 'Grace Reyes' },
  { userId: 'user-2', name: 'Ana Cruz' },
]

function Harness({ onMention = vi.fn() }: { onMention?: (userId: string) => void }) {
  const [value, setValue] = useState('')

  return (
    <MentionTextarea
      value={value}
      onChange={setValue}
      onMention={onMention}
      colleagues={COLLEAGUES}
      label="Add a comment"
      description="Type @ to mention someone."
    />
  )
}

describe('MentionTextarea', () => {
  it('stays quiet until an @ is typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Add a comment'), 'Thanks for this')

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('offers everyone the moment the @ lands', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Add a comment'), 'Thanks @')

    expect(await screen.findByRole('option', { name: 'Grace Reyes' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ana Cruz' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Everyone/ })).toBeInTheDocument()
  })

  it('narrows the list to what is typed after it', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Add a comment'), 'cc @rey')

    expect(await screen.findByRole('option', { name: 'Grace Reyes' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Ana Cruz' })).not.toBeInTheDocument()
  })

  it('writes the whole name and says who was meant', async () => {
    const user = userEvent.setup()
    const onMention = vi.fn()
    render(<Harness onMention={onMention} />)

    const box = screen.getByLabelText('Add a comment')
    await user.type(box, 'cc @rey')
    await user.click(await screen.findByRole('option', { name: 'Grace Reyes' }))

    expect(box).toHaveValue('cc @Grace Reyes ')
    expect(onMention).toHaveBeenCalledWith('user-1')
  })

  it('takes the keyboard path from open to picked', async () => {
    const user = userEvent.setup()
    const onMention = vi.fn()
    render(<Harness onMention={onMention} />)

    const box = screen.getByLabelText('Add a comment')
    await user.type(box, 'cc @')
    await screen.findByRole('option', { name: 'Grace Reyes' })
    await user.keyboard('{ArrowDown}{Enter}')

    // The first option is Everyone, so one step down lands on the first colleague.
    expect(onMention).toHaveBeenCalledWith('user-1')
    expect(box).toHaveValue('cc @Grace Reyes ')
  })

  it('leaves an email address alone', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Add a comment'), 'mail grace@innovarehp')

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('closes on Escape without picking anybody', async () => {
    const user = userEvent.setup()
    const onMention = vi.fn()
    render(<Harness onMention={onMention} />)

    await user.type(screen.getByLabelText('Add a comment'), 'cc @')
    await screen.findByRole('option', { name: 'Grace Reyes' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(onMention).not.toHaveBeenCalled()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness />)

    expect(await axe(container)).toHaveNoViolations()
  })
})

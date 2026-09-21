import { fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { CommentComposer } from './comment-composer'

const onPost = vi.fn(async () => {})

function renderComposer() {
  return render(
    <CommentComposer
      colleagues={[{ userId: 'user-2', name: 'Grace Hopper' }]}
      isPosting={false}
      onPost={onPost}
    />,
  )
}

function drop(target: HTMLElement, files: File[]) {
  // user-event has no drop gesture, so the DataTransfer is handed over directly.
  fireEvent.drop(target, { dataTransfer: { files } })
}

describe('CommentComposer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stages a dropped file and posts it with the comment', async () => {
    const user = userEvent.setup()
    const { container } = renderComposer()
    const form = container.querySelector('form') as HTMLElement

    drop(form, [new File(['hello'], 'renewal-pack.pdf', { type: 'application/pdf' })])

    expect(await screen.findByText('renewal-pack.pdf')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Add a comment'), 'Pack attached.')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() =>
      expect(onPost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Pack attached.',
          files: [expect.objectContaining({ name: 'renewal-pack.pdf' })],
        }),
      ),
    )
  })

  it('says why a dropped file was refused, rather than staging it', async () => {
    const { container } = renderComposer()
    const form = container.querySelector('form') as HTMLElement

    drop(form, [new File(['x'], 'payload.exe', { type: 'application/x-msdownload' })])

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('payload.exe')).not.toBeInTheDocument()
  })

  it('takes a staged file back off before posting', async () => {
    const user = userEvent.setup()
    const { container } = renderComposer()
    const form = container.querySelector('form') as HTMLElement

    drop(form, [new File(['hello'], 'renewal-pack.pdf', { type: 'application/pdf' })])
    await screen.findByText('renewal-pack.pdf')

    await user.click(screen.getByRole('button', { name: 'Remove renewal-pack.pdf' }))

    expect(screen.queryByText('renewal-pack.pdf')).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderComposer()

    expect(await axe(container)).toHaveNoViolations()
  })
})

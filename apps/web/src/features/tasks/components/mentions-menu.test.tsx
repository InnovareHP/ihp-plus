import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { TaskMentionFeed } from '../schema'
import { MentionsMenu } from './mentions-menu'

const rpc = vi.hoisted(() => ({
  listMentions: vi.fn(),
  markMentionRead: vi.fn(),
  markAllMentionsRead: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const FEED: TaskMentionFeed = {
  unreadCount: 1,
  mentions: [
    {
      commentId: 'comment-1',
      taskId: 'task-1',
      taskNumber: 14,
      taskName: 'Send the renewal pack',
      projectId: 'project-1',
      authorName: 'Grace Hopper',
      excerpt: 'Can you confirm the figures before Friday?',
      createdAt: '2026-09-20T09:00:00.000Z',
      isRead: false,
    },
    {
      commentId: 'comment-2',
      taskId: 'task-2',
      taskNumber: 15,
      taskName: 'Chase the signature',
      projectId: 'project-1',
      authorName: 'Ada Lovelace',
      excerpt: 'Signed and filed.',
      createdAt: '2026-09-19T09:00:00.000Z',
      isRead: true,
    },
  ],
}

describe('MentionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listMentions.mockResolvedValue(FEED)
    rpc.markMentionRead.mockResolvedValue(undefined)
    rpc.markAllMentionsRead.mockResolvedValue(undefined)
  })

  it('counts the unread ones in its own name', async () => {
    render(<MentionsMenu />)

    expect(await screen.findByRole('button', { name: 'Mentions, 1 unread' })).toBeInTheDocument()
  })

  it('says so plainly when nothing is waiting', async () => {
    rpc.listMentions.mockResolvedValue({ mentions: [], unreadCount: 0 })
    const user = userEvent.setup()
    render(<MentionsMenu />)

    await user.click(await screen.findByRole('button', { name: 'Mentions, nothing unread' }))

    expect(await screen.findByText('Nobody has named you on a task yet.')).toBeInTheDocument()
  })

  it('links each mention to the task it was written on', async () => {
    const user = userEvent.setup()
    render(<MentionsMenu />)

    await user.click(await screen.findByRole('button', { name: 'Mentions, 1 unread' }))

    expect(await screen.findByRole('menuitem', { name: /Send the renewal pack/ })).toHaveAttribute(
      'href',
      '/tasks?project=project-1&task=task-1',
    )
  })

  it('marks one read when it is opened, and not one already read', async () => {
    const user = userEvent.setup()
    render(<MentionsMenu />)

    await user.click(await screen.findByRole('button', { name: 'Mentions, 1 unread' }))
    await user.click(await screen.findByRole('menuitem', { name: /Send the renewal pack/ }))

    await waitFor(() => expect(rpc.markMentionRead).toHaveBeenCalledWith('comment-1', true))
    expect(rpc.markMentionRead).toHaveBeenCalledTimes(1)
  })

  it('clears the badge before the server answers, and puts it back on failure', async () => {
    const user = userEvent.setup()
    rpc.markAllMentionsRead.mockRejectedValue(new Error('Could not reach the server.'))
    render(<MentionsMenu />)

    await user.click(await screen.findByRole('button', { name: 'Mentions, 1 unread' }))
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mentions, 1 unread' })).toBeInTheDocument(),
    )
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Could not reach the server.' }),
    )
  })

  it('has no axe violations', async () => {
    const { container } = render(<MentionsMenu />)
    await screen.findByRole('button', { name: 'Mentions, 1 unread' })

    expect(await axe(container)).toHaveNoViolations()
  })
})

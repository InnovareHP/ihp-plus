import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { TaskCommentRow, TaskRow, TaskStatusRow } from '../schema'
import { TaskDetailDrawer } from './task-detail-drawer'

const rpc = vi.hoisted(() => ({
  listConversation: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  deleteAttachment: vi.fn(),
}))

const actions = vi.hoisted(() => ({ uploadTaskAttachment: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const STATUS: TaskStatusRow = {
  id: 'status-todo',
  name: 'To do',
  color: '#95E5DC',
  category: 'active',
  sortOrder: 1,
}

const TASK: TaskRow = {
  id: 'task-1',
  taskNumber: 14,
  name: 'Send the renewal pack',
  description: 'The Q1 pack for Meridian.',
  priority: 'normal',
  projectId: 'project-1',
  listId: 'list-1',
  statusId: 'status-todo',
  status: STATUS,
  assignees: [{ userId: 'user-2', name: 'Grace Hopper' }],
  startDate: undefined,
  dueDate: undefined,
  completedAt: undefined,
  isArchived: false,
  position: 1024,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  commentCount: 1,
  attachmentCount: 1,
}

const COMMENT: TaskCommentRow = {
  id: 'comment-1',
  taskId: 'task-1',
  authorId: 'user-2',
  authorName: 'Grace Hopper',
  body: 'The figures are confirmed.',
  mentions: [],
  attachments: [],
  editedAt: undefined,
  createdAt: '2026-09-02T00:00:00.000Z',
}

const VIEWER = { userId: 'user-1', name: 'Dana Reyes' }
const COLLEAGUES = [{ userId: 'user-2', name: 'Grace Hopper' }]

function renderDrawer() {
  return render(
    <TaskDetailDrawer task={TASK} viewer={VIEWER} colleagues={COLLEAGUES} onClose={vi.fn()} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.listConversation.mockResolvedValue({
    comments: [COMMENT],
    attachments: [
      {
        id: 'file-1',
        fileName: 'renewal-pack.pdf',
        contentType: 'application/pdf',
        fileSize: 48_000,
        url: 'https://example.test/renewal-pack.pdf',
        uploadedByName: 'Grace Hopper',
        createdAt: '2026-09-02T00:00:00.000Z',
        commentId: undefined,
      },
    ],
  })
})

describe('TaskDetailDrawer', () => {
  it('shows the task, its files and the conversation on it', async () => {
    renderDrawer()

    expect(await screen.findByText('The figures are confirmed.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'renewal-pack.pdf' })).toBeInTheDocument()
    expect(screen.getByText('47 KB · Grace Hopper')).toBeInTheDocument()
  })

  it('paints a comment before the server answers', async () => {
    const user = userEvent.setup()
    let resolve: ((comment: TaskCommentRow) => void) | undefined
    rpc.createComment.mockReturnValue(
      new Promise<TaskCommentRow>((done) => {
        resolve = done
      }),
    )

    renderDrawer()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Chasing this today.')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByText('Chasing this today.')).toBeInTheDocument()
    expect(screen.getByText('Dana Reyes')).toBeInTheDocument()

    resolve?.({ ...COMMENT, id: 'comment-2', body: 'Chasing this today.' })
  })

  it('takes the comment back and says why when posting fails', async () => {
    const user = userEvent.setup()
    rpc.createComment.mockRejectedValue(new Error('The task is no longer there.'))

    renderDrawer()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Chasing this today.')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(screen.queryByText('Chasing this today.')).not.toBeInTheDocument())
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'The task is no longer there.', autoClose: false }),
    )
  })

  it('refuses an empty comment and announces why', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await screen.findByText('The figures are confirmed.')

    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByText('Write something before posting.')).toBeInTheDocument()
    expect(rpc.createComment).not.toHaveBeenCalled()
  })

  it('names a colleague in the body when they are mentioned', async () => {
    const user = userEvent.setup()
    rpc.createComment.mockResolvedValue({ ...COMMENT, id: 'comment-2' })

    renderDrawer()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Can you confirm')
    await user.click(screen.getByRole('button', { name: 'Mention someone' }))
    await user.click(screen.getByRole('menuitem', { name: 'Grace Hopper' }))
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() =>
      expect(rpc.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Can you confirm @Grace Hopper',
          mentionUserIds: ['user-2'],
        }),
      ),
    )
  })

  it('offers no edit or delete on someone else’s comment', async () => {
    renderDrawer()
    await screen.findByText('The figures are confirmed.')

    expect(
      screen.queryByRole('button', { name: 'Actions for your comment' }),
    ).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderDrawer()
    await screen.findByText('The figures are confirmed.')
    expect(await axe(container)).toHaveNoViolations()
  })
})

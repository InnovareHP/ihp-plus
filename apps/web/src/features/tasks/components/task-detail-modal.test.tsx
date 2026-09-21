import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { act, render, screen, userEvent, waitFor, within } from '@/test/render'
import type { TaskCommentRow, TaskRow, TaskStatusRow } from '../schema'
import { TaskDetailModal } from './task-detail-modal'

const rpc = vi.hoisted(() => ({
  createTask: vi.fn(),
  completeTask: vi.fn(),
  deleteTask: vi.fn(),
  listConversation: vi.fn(),
  listTaskActivity: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  deleteAttachment: vi.fn(),
}))

const actions = vi.hoisted(() => ({ uploadTaskAttachment: vi.fn() }))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('../actions', () => actions)
vi.mock('@/lib/undo', () => undo)
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
  parentId: undefined,
  subtasks: [],
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

function renderModal(task: TaskRow = TASK) {
  return render(
    <TaskDetailModal
      task={task}
      viewer={VIEWER}
      colleagues={COLLEAGUES}
      onClose={vi.fn()}
      onOpenTask={vi.fn()}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.deleteAttachment.mockResolvedValue(undefined)
  rpc.listTaskActivity.mockResolvedValue([
    {
      id: 'activity-1',
      label: 'Task created',
      actorName: 'Grace Hopper',
      detail: 'Send the renewal pack',
      createdAt: '2026-09-01T09:00:00.000Z',
    },
  ])
  rpc.listConversation.mockResolvedValue({
    comments: [
      {
        ...COMMENT,
        attachments: [
          {
            id: 'file-1',
            fileName: 'renewal-pack.pdf',
            contentType: 'application/pdf',
            fileSize: 48_000,
            url: 'https://example.test/renewal-pack.pdf',
            uploadedByName: 'Grace Hopper',
            createdAt: '2026-09-02T00:00:00.000Z',
            commentId: 'comment-1',
          },
        ],
      },
    ],
  })
})

describe('TaskDetailModal', () => {
  it('shows the conversation with each file under the comment it was posted in', async () => {
    renderModal()

    const body = await screen.findByText('The figures are confirmed.')
    const comment = body.closest('li')
    expect(comment).not.toBeNull()

    expect(
      within(comment as HTMLElement).getByRole('link', { name: 'renewal-pack.pdf' }),
    ).toBeInTheDocument()
    expect(within(comment as HTMLElement).getByText('47 KB · Grace Hopper')).toBeInTheDocument()
    // The task has no shelf of its own any more: a file arrives with a comment or not at all.
    expect(screen.queryByText('Files on this task')).not.toBeInTheDocument()
  })

  it('stores a picked file only once the comment carrying it is posted', async () => {
    const user = userEvent.setup()
    actions.uploadTaskAttachment.mockResolvedValue({ ok: true, data: { id: 'file-9' } })
    rpc.createComment.mockResolvedValue({ ...COMMENT, id: 'comment-2' })

    const { container } = renderModal()
    await screen.findByText('The figures are confirmed.')

    const picker = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(picker, new File(['pack'], 'renewal.pdf', { type: 'application/pdf' }))

    // Held by the composer: nothing travels until there is a comment to attach it to.
    expect(screen.getByText('renewal.pdf')).toBeInTheDocument()
    expect(actions.uploadTaskAttachment).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Add a comment'), 'Here it is.')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(actions.uploadTaskAttachment).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(rpc.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentIds: ['file-9'] }),
      ),
    )
  })

  it('takes the stored file back when the comment it belonged to fails', async () => {
    const user = userEvent.setup()
    actions.uploadTaskAttachment.mockResolvedValue({ ok: true, data: { id: 'file-9' } })
    rpc.createComment.mockRejectedValue(new Error('Could not post that comment.'))

    const { container } = renderModal()
    await screen.findByText('The figures are confirmed.')

    const picker = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(picker, new File(['pack'], 'renewal.pdf', { type: 'application/pdf' }))
    await user.type(screen.getByLabelText('Add a comment'), 'Here it is.')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    // No comment means no file: the orphan the upload would leave is deleted again.
    await waitFor(() => expect(rpc.deleteAttachment).toHaveBeenCalledWith('file-9'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not post that comment.')
  })

  it('refuses a file the storage rule would reject, before it travels', async () => {
    const user = userEvent.setup()

    const { container } = renderModal()
    await screen.findByText('The figures are confirmed.')

    const picker = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(picker, new File(['x'], 'macro.exe', { type: 'application/x-msdownload' }))

    expect(
      await screen.findByText('Attach a PDF, Office document, text file or image.'),
    ).toBeInTheDocument()
    expect(actions.uploadTaskAttachment).not.toHaveBeenCalled()
  })

  it('paints a comment before the server answers', async () => {
    const user = userEvent.setup()
    let resolve: ((comment: TaskCommentRow) => void) | undefined
    rpc.createComment.mockReturnValue(
      new Promise<TaskCommentRow>((done) => {
        resolve = done
      }),
    )

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Chasing this today.')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByText('Chasing this today.')).toBeInTheDocument()
    // Own words are bylined "You", not with the viewer's own name back at them.
    expect(screen.getByText('You')).toBeInTheDocument()

    resolve?.({ ...COMMENT, id: 'comment-2', body: 'Chasing this today.' })
  })

  it("tells the viewer's own words apart from a colleague's", async () => {
    rpc.listConversation.mockResolvedValue({
      comments: [
        COMMENT,
        {
          ...COMMENT,
          id: 'comment-2',
          authorId: VIEWER.userId,
          authorName: VIEWER.name,
          body: 'On it.',
        },
      ],
      attachments: [],
    })

    renderModal()

    const own = (await screen.findByText('On it.')).closest('li')
    const theirs = screen.getByText('The figures are confirmed.').closest('li')

    expect(within(own as HTMLElement).getByText('You')).toBeInTheDocument()
    expect(within(theirs as HTMLElement).getByText('Grace Hopper')).toBeInTheDocument()
  })

  it("keeps the task's history one click away, folded", async () => {
    const user = userEvent.setup()
    renderModal()

    const history = await screen.findByRole('button', { name: 'History' })
    expect(history).toHaveAttribute('aria-expanded', 'false')

    await user.click(history)

    expect(await screen.findByText('Task created')).toBeInTheDocument()
  })

  it('lists the subtasks with how far the work has got', async () => {
    renderModal({
      ...TASK,
      subtasks: [
        { id: 'subtask-1', name: 'Pull the figures', isDone: true, position: 1024 },
        { id: 'subtask-2', name: 'Draft the letter', isDone: false, position: 2048 },
      ],
    })

    expect(await screen.findByText('1 of 2 done')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Complete Draft the letter' })).not.toBeChecked()
  })

  it('files a new subtask under the task it is open on', async () => {
    const user = userEvent.setup()
    rpc.createTask.mockResolvedValue({ ...TASK, id: 'task-2', name: 'Book the courier' })

    renderModal()
    await user.type(await screen.findByLabelText('Add a subtask'), 'Book the courier')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(rpc.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Book the courier',
          parentId: 'task-1',
          listId: 'list-1',
        }),
      ),
    )
  })

  it('ticks a subtask off through the same call a task uses', async () => {
    const user = userEvent.setup()
    rpc.completeTask.mockResolvedValue({ ...TASK, id: 'subtask-1' })

    renderModal({
      ...TASK,
      subtasks: [{ id: 'subtask-1', name: 'Pull the figures', isDone: false, position: 1024 }],
    })

    await user.click(await screen.findByRole('checkbox', { name: 'Complete Pull the figures' }))

    await waitFor(() => expect(rpc.completeTask).toHaveBeenCalledWith('subtask-1', true))
  })

  it('takes the comment back and says why when posting fails', async () => {
    const user = userEvent.setup()
    rpc.createComment.mockRejectedValue(new Error('The task is no longer there.'))

    renderModal()
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
    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByText('Write something before posting.')).toBeInTheDocument()
    expect(rpc.createComment).not.toHaveBeenCalled()
  })

  it('notifies whoever the composer names, leaving the body as typed', async () => {
    const user = userEvent.setup()
    rpc.createComment.mockResolvedValue({ ...COMMENT, id: 'comment-2' })

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Can you confirm')
    await user.click(screen.getByRole('combobox', { name: 'Notify' }))
    await user.click(await screen.findByRole('option', { name: 'Grace Hopper' }))
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() =>
      expect(rpc.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Can you confirm',
          mentionUserIds: ['user-2'],
        }),
      ),
    )
  })

  it('notifies the whole organization when everyone is picked', async () => {
    const user = userEvent.setup()
    rpc.createComment.mockResolvedValue({ ...COMMENT, id: 'comment-2' })

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Board review is Friday')
    await user.click(screen.getByRole('combobox', { name: 'Notify' }))
    await user.click(await screen.findByRole('option', { name: 'Grace Hopper' }))
    await user.click(await screen.findByRole('option', { name: 'Everyone in this organization' }))
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    await waitFor(() =>
      expect(rpc.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Board review is Friday',
          // The wider pick replaces the names it already covers.
          mentionUserIds: ['everyone'],
        }),
      ),
    )
  })

  it('keeps the people a comment named when it is edited', async () => {
    const user = userEvent.setup()
    rpc.listConversation.mockResolvedValue({
      comments: [
        {
          ...COMMENT,
          authorId: VIEWER.userId,
          authorName: VIEWER.name,
          mentions: [{ userId: 'user-2', name: 'Grace Hopper' }],
        },
      ],
      attachments: [],
    })
    rpc.updateComment.mockResolvedValue({ ...COMMENT, body: 'The figures are signed off.' })

    renderModal()
    await screen.findByText('The figures are confirmed.')
    expect(screen.getByText('Notified')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Actions for your comment' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Edit your comment'))
    await user.type(screen.getByLabelText('Edit your comment'), 'The figures are signed off.')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(rpc.updateComment).toHaveBeenCalledWith('comment-1', 'The figures are signed off.', [
        'user-2',
      ]),
    )
  })

  it('posts with ⌘ + Enter', async () => {
    const user = userEvent.setup()
    rpc.createComment.mockResolvedValue({ ...COMMENT, id: 'comment-2' })

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Chasing this today.')
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    await waitFor(() =>
      expect(rpc.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Chasing this today.' }),
      ),
    )
  })

  it('holds a deleted comment back until the undo window closes', async () => {
    const user = userEvent.setup()
    rpc.listConversation.mockResolvedValue({
      comments: [{ ...COMMENT, authorId: VIEWER.userId, authorName: VIEWER.name }],
      attachments: [],
    })

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.click(screen.getByRole('button', { name: 'Actions for your comment' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.queryByText('The figures are confirmed.')).not.toBeInTheDocument(),
    )
    expect(rpc.deleteComment).not.toHaveBeenCalled()

    const offer = undo.offerUndo.mock.calls[0]?.[0]
    await act(async () => offer.onUndo())

    expect(await screen.findByText('The figures are confirmed.')).toBeInTheDocument()
    expect(rpc.deleteComment).not.toHaveBeenCalled()
  })

  it('tells the server once the undo window has closed', async () => {
    const user = userEvent.setup()
    rpc.listConversation.mockResolvedValue({
      comments: [{ ...COMMENT, authorId: VIEWER.userId, authorName: VIEWER.name }],
      attachments: [],
    })
    rpc.deleteComment.mockResolvedValue(undefined)

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.click(screen.getByRole('button', { name: 'Actions for your comment' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const offer = undo.offerUndo.mock.calls[0]?.[0]
    await act(async () => offer.onCommit())

    await waitFor(() => expect(rpc.deleteComment).toHaveBeenCalledWith('comment-1'))
  })

  it('keeps the edit open and says why when saving fails', async () => {
    const user = userEvent.setup()
    rpc.listConversation.mockResolvedValue({
      comments: [{ ...COMMENT, authorId: VIEWER.userId, authorName: VIEWER.name }],
      attachments: [],
    })
    rpc.updateComment.mockRejectedValue(new Error('That comment is no longer there.'))

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.click(screen.getByRole('button', { name: 'Actions for your comment' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Edit your comment'), ' Chased.')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('That comment is no longer there.')).toBeInTheDocument()
    expect(screen.getByLabelText('Edit your comment')).toHaveValue(
      'The figures are confirmed. Chased.',
    )
  })

  it('marks a comment that has not landed yet', async () => {
    const user = userEvent.setup()
    rpc.createComment.mockReturnValue(new Promise(() => {}))

    renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.type(screen.getByLabelText('Add a comment'), 'Chasing this today.')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByText('Sending…')).toBeInTheDocument()
  })

  it('offers no edit or delete on someone else’s comment', async () => {
    renderModal()
    await screen.findByText('The figures are confirmed.')

    expect(
      screen.queryByRole('button', { name: 'Actions for your comment' }),
    ).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderModal()
    await screen.findByText('The figures are confirmed.')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations while a comment is being edited', async () => {
    const user = userEvent.setup()
    rpc.listConversation.mockResolvedValue({
      comments: [{ ...COMMENT, authorId: VIEWER.userId, authorName: VIEWER.name }],
      attachments: [],
    })

    const { container } = renderModal()
    await screen.findByText('The figures are confirmed.')

    await user.click(screen.getByRole('button', { name: 'Actions for your comment' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})

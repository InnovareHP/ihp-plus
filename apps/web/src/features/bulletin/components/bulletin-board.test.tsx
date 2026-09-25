import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { BulletinFeed, BulletinPostRow } from '../schema'
import { BulletinBoard } from './bulletin-board'

const rpc = vi.hoisted(() => ({
  listPosts: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  setPostPinned: vi.fn(),
  toggleReaction: vi.fn(),
  listComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

const actions = vi.hoisted(() => ({ uploadBulletinImage: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/bulletin',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const PINNED: BulletinPostRow = {
  id: 'post-pinned',
  authorId: 'user-2',
  authorName: 'Grace Hopper',
  body: 'Open enrolment closes Friday.',
  pinnedAt: '2026-09-20T09:00:00.000Z',
  editedAt: undefined,
  createdAt: '2026-09-19T09:00:00.000Z',
  commentCount: 0,
  reactions: [],
  images: [],
}

const LATEST: BulletinPostRow = {
  id: 'post-latest',
  authorId: 'user-2',
  authorName: 'Grace Hopper',
  body: 'Cake in the kitchen.',
  pinnedAt: undefined,
  editedAt: undefined,
  createdAt: '2026-09-24T09:00:00.000Z',
  commentCount: 2,
  reactions: [{ emoji: '🎉', count: 1, reactedByMe: false }],
  images: [],
}

function feed(overrides: Partial<BulletinFeed> = {}): BulletinFeed {
  return {
    posts: [PINNED, LATEST],
    hasMore: false,
    viewerId: 'user-1',
    canModerate: false,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function section(name: string) {
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  vi.clearAllMocks()
  nav.search = ''
  rpc.listPosts.mockResolvedValue(feed())
  rpc.listComments.mockResolvedValue([])
})

describe('BulletinBoard', () => {
  it('shows pinned posts above the latest ones', async () => {
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    expect(within(section('Pinned')).getByText(PINNED.body)).toBeInTheDocument()
    expect(within(section('Latest')).getByText(LATEST.body)).toBeInTheDocument()
    expect(rpc.listPosts).toHaveBeenCalledWith(20)
  })

  it('names the benefit when the board is empty', async () => {
    rpc.listPosts.mockResolvedValue(feed({ posts: [] }))
    render(<BulletinBoard />)

    expect(await screen.findByText('Nothing on the board yet')).toBeInTheDocument()
  })

  it('offers a retry when the feed fails', async () => {
    const user = userEvent.setup()
    rpc.listPosts.mockRejectedValueOnce(new Error('Network down.'))
    render(<BulletinBoard />)

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByText(LATEST.body)).toBeInTheDocument()
  })

  it('gives a member no composer, only the posts to react and reply to', async () => {
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    expect(screen.queryByLabelText(/Share an update/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Post' })).not.toBeInTheDocument()
  })

  it('says what is missing before posting an empty update', async () => {
    const user = userEvent.setup()
    rpc.listPosts.mockResolvedValue(feed({ canModerate: true }))
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    await user.click(screen.getByRole('button', { name: 'Post' }))

    expect(
      await screen.findByText('Write something or add a photo before posting.'),
    ).toBeInTheDocument()
    expect(rpc.createPost).not.toHaveBeenCalled()
  })

  it('shows a new post before the server answers', async () => {
    const user = userEvent.setup()
    const pending = deferred<BulletinPostRow>()
    rpc.createPost.mockReturnValue(pending.promise)
    rpc.listPosts.mockResolvedValue(feed({ canModerate: true }))
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    await user.type(screen.getByLabelText(/Share an update/), 'Welcome, Ada!')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    expect(await within(section('Latest')).findByText('Welcome, Ada!')).toBeInTheDocument()
    expect(rpc.createPost).toHaveBeenCalledWith('Welcome, Ada!', [])

    pending.resolve({ ...LATEST, id: 'post-new', body: 'Welcome, Ada!' })
  })

  it('takes a failed post back off the board, says why, and keeps the words', async () => {
    const user = userEvent.setup()
    rpc.createPost.mockRejectedValue(new Error('The board is read-only right now.'))
    rpc.listPosts.mockResolvedValue(feed({ canModerate: true }))
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    await user.type(screen.getByLabelText(/Share an update/), 'Welcome, Ada!')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The board is read-only right now.')
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'The board is read-only right now.' }),
    )
    expect(within(section('Latest')).queryByText('Welcome, Ada!')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Share an update/)).toHaveValue('Welcome, Ada!')
  })

  it('counts a reaction at once and restores the count when it fails', async () => {
    const user = userEvent.setup()
    const pending = deferred<BulletinPostRow>()
    rpc.toggleReaction.mockReturnValue(pending.promise)
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    const latest = section('Latest')
    await user.click(within(latest).getByRole('button', { name: 'Celebrate: 1' }))

    expect(
      await within(latest).findByRole('button', { name: 'Celebrate: 2, including you' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(rpc.toggleReaction).toHaveBeenCalledWith(LATEST.id, '🎉')

    pending.reject(new Error('Could not react — try again.'))

    expect(await within(latest).findByRole('button', { name: 'Celebrate: 1' })).toBeInTheDocument()
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'Could not react — try again.' }),
    )
  })

  it('gives a member no pin or delete control on someone else’s post', async () => {
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    expect(screen.queryByRole('button', { name: /Actions for the post/ })).not.toBeInTheDocument()
  })

  it('moves a post into Pinned when an admin pins it', async () => {
    const user = userEvent.setup()
    rpc.listPosts.mockResolvedValue(feed({ canModerate: true }))
    rpc.setPostPinned.mockReturnValue(new Promise(() => {}))
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    await user.click(
      within(section('Latest')).getByRole('button', {
        name: 'Actions for the post by Grace Hopper',
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Pin to the top' }))

    expect(await within(section('Pinned')).findByText(LATEST.body)).toBeInTheDocument()
    expect(rpc.setPostPinned).toHaveBeenCalledWith(LATEST.id, true)
  })

  it('opens the replies and sends one', async () => {
    const user = userEvent.setup()
    rpc.listComments.mockResolvedValue([
      {
        id: 'comment-1',
        postId: LATEST.id,
        authorId: 'user-2',
        authorName: 'Grace Hopper',
        body: 'Chocolate, too.',
        editedAt: undefined,
        createdAt: '2026-09-24T10:00:00.000Z',
      },
    ])
    rpc.createComment.mockReturnValue(new Promise(() => {}))
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    const toggle = within(section('Latest')).getByRole('button', { name: '2 replies' })
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('Chocolate, too.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Write a reply'), 'On my way.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByText('On my way.')).toBeInTheDocument()
    await waitFor(() => expect(rpc.createComment).toHaveBeenCalledWith(LATEST.id, 'On my way.'))
  })

  it('uploads a photo, previews it, and posts it with the words', async () => {
    const user = userEvent.setup()
    rpc.listPosts.mockResolvedValue(feed({ canModerate: true }))
    rpc.createPost.mockReturnValue(new Promise(() => {}))
    actions.uploadBulletinImage.mockResolvedValue({
      ok: true,
      data: { id: 'img-1', url: '/app/api/bulletin/images/img-1' },
    })
    const { container } = render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('The composer has no file input.')
    await user.upload(input, new File(['x'], 'team.png', { type: 'image/png' }))

    expect(await screen.findByRole('img', { name: 'Photo 1' })).toBeInTheDocument()
    expect(screen.getByText('1 of 4')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Share an update/), 'Team day!')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    await waitFor(() => expect(rpc.createPost).toHaveBeenCalledWith('Team day!', ['img-1']))
    expect(
      await screen.findByRole('img', { name: "Photo 1 of 1 from You's post" }),
    ).toBeInTheDocument()
  })

  it('says why a photo was refused and adds nothing', async () => {
    const user = userEvent.setup({ applyAccept: false })
    rpc.listPosts.mockResolvedValue(feed({ canModerate: true }))
    const { container } = render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('The composer has no file input.')
    await user.upload(input, new File(['x'], 'notes.pdf', { type: 'application/pdf' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'notes.pdf: Add a JPEG, PNG or WebP photo.',
    )
    expect(actions.uploadBulletinImage).not.toHaveBeenCalled()
  })

  it('opens a post’s photo larger and steps to the next one', async () => {
    const user = userEvent.setup()
    rpc.listPosts.mockResolvedValue(
      feed({
        posts: [
          {
            ...LATEST,
            images: [
              { id: 'img-1', url: '/app/api/bulletin/images/img-1' },
              { id: 'img-2', url: '/app/api/bulletin/images/img-2' },
            ],
          },
        ],
      }),
    )
    render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    await user.click(screen.getByRole('button', { name: "Photo 1 of 2 from Grace Hopper's post" }))
    const viewer = await screen.findByRole('dialog', { name: 'Photo 1 of 2' })
    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }))

    expect(await screen.findByRole('dialog', { name: 'Photo 2 of 2' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    rpc.listPosts.mockResolvedValue(feed({ canModerate: true }))
    const { container } = render(<BulletinBoard />)
    await screen.findByText(LATEST.body)

    expect(await axe(container)).toHaveNoViolations()
  })
})

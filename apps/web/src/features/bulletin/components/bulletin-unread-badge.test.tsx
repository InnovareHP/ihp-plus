import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import { BulletinUnreadBadge } from './bulletin-unread-badge'

const rpc = vi.hoisted(() => ({ getUnreadCount: vi.fn() }))

vi.mock('../rpc', () => rpc)

beforeEach(() => vi.clearAllMocks())

describe('BulletinUnreadBadge', () => {
  it('names the count for a screen reader', async () => {
    rpc.getUnreadCount.mockResolvedValue(3)
    render(<BulletinUnreadBadge />)

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByText('new')).toBeInTheDocument()
  })

  it('caps a long wait at 9+', async () => {
    rpc.getUnreadCount.mockResolvedValue(42)
    render(<BulletinUnreadBadge />)

    expect(await screen.findByText('9+')).toBeInTheDocument()
  })

  it('shows nothing when there is nothing new', async () => {
    rpc.getUnreadCount.mockResolvedValue(0)
    render(<BulletinUnreadBadge />)
    await vi.waitFor(() => expect(rpc.getUnreadCount).toHaveBeenCalled())

    expect(screen.queryByText('new')).not.toBeInTheDocument()
  })

  it('shows nothing when the count cannot be read', async () => {
    rpc.getUnreadCount.mockRejectedValue(new Error('offline'))
    render(<BulletinUnreadBadge />)
    await vi.waitFor(() => expect(rpc.getUnreadCount).toHaveBeenCalled())

    expect(screen.queryByText('new')).not.toBeInTheDocument()
  })
})

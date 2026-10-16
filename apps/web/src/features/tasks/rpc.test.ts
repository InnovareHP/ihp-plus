import { describe, expect, it, vi } from 'vitest'
import { getRunningTimer } from './rpc'

const clients = vi.hoisted(() => ({ tasks: { getRunningTimer: vi.fn() } }))
vi.mock('@/rpc/browser', () => ({ browserClients: clients }))

describe('getRunningTimer', () => {
  it('answers null, not undefined, when no timer is running', async () => {
    clients.tasks.getRunningTimer.mockResolvedValue({})

    await expect(getRunningTimer()).resolves.toBeNull()
  })
})

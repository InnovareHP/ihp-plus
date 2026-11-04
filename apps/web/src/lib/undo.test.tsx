import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mantine = vi.hoisted(() => ({ notifications: { show: vi.fn(), hide: vi.fn() } }))

vi.mock('@mantine/notifications', () => mantine)

const { offerUndo, UNDO_WINDOW_MS } = await import('./undo')
const { render, screen, userEvent } = await import('@/test/render')

function offer() {
  const onCommit = vi.fn()
  const onUndo = vi.fn()
  offerUndo({ message: 'Deleted', undoLabel: 'Undo', onUndo, onCommit })
  const shown = mantine.notifications.show.mock.calls.at(-1)?.[0]
  return { onCommit, onUndo, shown }
}

describe('offerUndo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits when the window ends even if the toast never got shown', () => {
    const { onCommit } = offer()

    vi.advanceTimersByTime(UNDO_WINDOW_MS)

    expect(onCommit).toHaveBeenCalledOnce()
  })

  it('commits open windows when the page goes away', () => {
    const { onCommit } = offer()

    window.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(UNDO_WINDOW_MS)

    expect(onCommit).toHaveBeenCalledOnce()
  })

  it('commits once when the toast is dismissed early', () => {
    const { onCommit, shown } = offer()

    shown.onClose()
    vi.advanceTimersByTime(UNDO_WINDOW_MS)
    shown.onClose()

    expect(onCommit).toHaveBeenCalledOnce()
  })

  it('undo cancels the commit for good', async () => {
    // user-event stalls on a fake clock; cancel clears the real window timer either way.
    vi.useRealTimers()
    const user = userEvent.setup()
    const { onCommit, onUndo, shown } = offer()
    render(shown.message)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    window.dispatchEvent(new Event('pagehide'))
    shown.onClose()

    expect(onUndo).toHaveBeenCalledOnce()
    expect(onCommit).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@/test/render'
import { RequestLeavePreview } from './request-leave-preview'

const rpc = vi.hoisted(() => ({ previewLeave: vi.fn() }))
vi.mock('../rpc', () => rpc)

beforeEach(() => {
  vi.clearAllMocks()
  rpc.previewLeave.mockResolvedValue({ workingDays: 3, balance: undefined })
})

describe('RequestLeavePreview', () => {
  it('counts the picked dates once both are set', async () => {
    render(<RequestLeavePreview formId="form-1" firstDay="2026-10-09" lastDay="2026-10-14" />)

    expect(await screen.findByRole('status')).toHaveTextContent('This request uses 3 days')
    expect(rpc.previewLeave).toHaveBeenCalledWith({
      formId: 'form-1',
      firstDay: '2026-10-09',
      lastDay: '2026-10-14',
    })
  })

  it('waits for both dates, in order, before asking', async () => {
    const { rerender } = render(
      <RequestLeavePreview formId="form-1" firstDay="2026-10-09" lastDay="" />,
    )
    rerender(<RequestLeavePreview formId="form-1" firstDay="2026-10-14" lastDay="2026-10-09" />)

    await waitFor(() => expect(rpc.previewLeave).not.toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

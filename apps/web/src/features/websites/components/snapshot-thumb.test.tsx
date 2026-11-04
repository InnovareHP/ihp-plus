import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { SnapshotThumb, type SnapshotThumbProps } from './snapshot-thumb'

const PROPS: SnapshotThumbProps = {
  state: 'ready',
  websiteName: 'Riverside site',
  roundLabel: 'Time in',
  thumbSrc: '/app/api/websites/snapshots/site-1/clock_in?size=thumb&v=1',
  fullSrc: '/app/api/websites/snapshots/site-1/clock_in?size=full&v=1',
  takenAt: '9:02 AM',
  canRetry: true,
}

describe('SnapshotThumb', () => {
  it('opens the full-size picture from the thumbnail', async () => {
    const user = userEvent.setup()
    const { container } = render(<SnapshotThumb {...PROPS} />)

    expect(await axe(container)).toHaveNoViolations()
    await user.click(
      screen.getByRole('button', {
        name: 'View snapshot of Riverside site at time in, taken at 9:02 AM',
      }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'Riverside site · Time in' })
    expect(dialog).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Snapshot of Riverside site at time in, taken at 9:02 AM' }),
    ).toHaveAttribute('src', PROPS.fullSrc)
  })

  it('opens from the keyboard and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<SnapshotThumb {...PROPS} />)

    await user.tab()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('holds the picture’s space while it is being taken', async () => {
    const { container } = render(<SnapshotThumb {...PROPS} state="pending" />)

    expect(screen.getByText('Taking snapshot…')).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('says when there is no picture, and how to get one if the viewer can', () => {
    const { unmount } = render(<SnapshotThumb {...PROPS} state="missing" />)
    expect(screen.getByText('No snapshot for this check. Check again to take one.')).toBeVisible()
    unmount()

    render(<SnapshotThumb {...PROPS} state="missing" canRetry={false} />)
    expect(screen.getByText('No snapshot for this check.')).toBeVisible()
  })
})

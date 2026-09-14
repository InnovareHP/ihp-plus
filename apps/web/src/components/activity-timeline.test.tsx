import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, within } from '@/test/render'
import { ActivityTimeline } from './activity-timeline'

const ITEMS = [
  {
    id: 'a-1',
    label: 'Request raised',
    actorName: 'Grace Hopper',
    detail: undefined,
    createdAt: '2026-09-14T09:00:00.000Z',
  },
  {
    id: 'a-2',
    label: 'Turned down',
    actorName: 'Ada Lovelace',
    detail: 'Those dates overlap the audit.',
    createdAt: '2026-09-15T10:30:00.000Z',
  },
]

describe('ActivityTimeline', () => {
  it('lists each change in order with who made it and why', () => {
    render(<ActivityTimeline items={ITEMS} label="Request history" />)

    const list = screen.getByRole('list', { name: 'Request history' })
    const entries = within(list).getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('Request raised')
    expect(entries[1]).toHaveTextContent('Ada Lovelace')
    expect(entries[1]).toHaveTextContent('Those dates overlap the audit.')
  })

  it('says why a subject has no history instead of rendering nothing', () => {
    render(<ActivityTimeline items={[]} label="Request history" />)

    expect(screen.getByText(/No history recorded yet/)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ActivityTimeline items={ITEMS} label="Request history" />)

    expect(await axe(container)).toHaveNoViolations()
  })
})

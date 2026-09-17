import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import { AttentionGrid } from './attention-grid'

// App Router's Link needs a mounted router; a plain anchor keeps the href under test.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const EVERYTHING = {
  approvalsWaiting: 4,
  openRequests: 2,
  contractsAwaitingClient: 3,
  failedPayments: 1,
}

describe('AttentionGrid', () => {
  it('links each count to the list that acts on it', () => {
    render(<AttentionGrid summary={EVERYTHING} />)

    expect(screen.getByRole('link', { name: 'Open approvals' })).toHaveAttribute(
      'href',
      '/requests/approvals',
    )
    expect(screen.getByRole('link', { name: 'View your requests' })).toHaveAttribute(
      'href',
      '/requests?status=pending',
    )
    expect(screen.getByRole('link', { name: 'View published contracts' })).toHaveAttribute(
      'href',
      '/clients?tab=contracts&status=sent',
    )
    expect(screen.getByText('Open invoices Stripe could not collect.')).toBeInTheDocument()
    expect(screen.queryByText('Nothing is waiting on you right now.')).not.toBeInTheDocument()
  })

  it('says plainly when nothing is waiting', () => {
    render(
      <AttentionGrid
        summary={{
          approvalsWaiting: 0,
          openRequests: 0,
          contractsAwaitingClient: 0,
          failedPayments: 0,
        }}
      />,
    )

    expect(screen.getByText('Nothing is waiting on you right now.')).toBeInTheDocument()
    expect(screen.getByText('Your approvals queue is clear.')).toBeInTheDocument()
  })

  it('offers no card for work the person cannot do', () => {
    render(
      <AttentionGrid
        summary={{
          approvalsWaiting: null,
          openRequests: 1,
          contractsAwaitingClient: null,
          failedPayments: null,
        }}
      />,
    )

    expect(screen.getByText('Your open requests')).toBeInTheDocument()
    expect(screen.queryByText('Waiting for your decision')).not.toBeInTheDocument()
    expect(screen.queryByText('Failed payments')).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<AttentionGrid summary={EVERYTHING} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})

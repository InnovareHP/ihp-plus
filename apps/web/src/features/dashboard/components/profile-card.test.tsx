import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import { ProfileCard } from './profile-card'
import { VerifiedBadge } from './verified-badge'

const ROWS = [
  { label: 'Role', value: 'Care coordinator' },
  { label: 'Email', value: 'ana@example.com' },
  { label: 'Email status', value: <VerifiedBadge verified={false} /> },
]

describe('ProfileCard', () => {
  it('pairs each value with its label in a description list', () => {
    render(<ProfileCard rows={ROWS} />)

    const terms = screen.getAllByRole('term').map((term) => term.textContent)
    const values = screen.getAllByRole('definition').map((value) => value.textContent)
    expect(terms).toEqual(['Role', 'Email', 'Email status'])
    expect(values).toEqual(['Care coordinator', 'ana@example.com', 'Unverified'])
  })

  it('shows the note only when there is something to act on', () => {
    const { rerender } = render(<ProfileCard rows={ROWS} />)
    expect(screen.queryByText(/check your inbox/i)).not.toBeInTheDocument()

    rerender(<ProfileCard rows={ROWS} note="Check your inbox for the verification link." />)
    expect(screen.getByText(/check your inbox/i)).toBeInTheDocument()
  })

  it('names the email state in text, not colour alone', () => {
    render(<VerifiedBadge verified />)
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ProfileCard rows={ROWS} note="Check your inbox." />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

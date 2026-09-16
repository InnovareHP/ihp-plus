import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import { AppLogo } from './app-logo'

describe('AppLogo', () => {
  it('exposes the brand name to assistive technology', () => {
    render(<AppLogo />)

    expect(screen.getByRole('img', { name: 'IHP+' })).toBeInTheDocument()
  })

  it('scales the lockup proportionally, never stretched', () => {
    render(<AppLogo height={28} />)

    const logo = screen.getByRole('img', { name: 'IHP+' })
    const [, , width, height] = (logo.getAttribute('viewBox') ?? '').split(' ').map(Number)

    expect(logo).toHaveAttribute('height', '28')
    expect(Number(logo.getAttribute('width'))).toBeCloseTo((28 * (width ?? 0)) / (height ?? 1), 5)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<AppLogo />)

    expect(await axe(container)).toHaveNoViolations()
  })
})

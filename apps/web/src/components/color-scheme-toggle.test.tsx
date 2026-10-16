import { MantineProvider } from '@mantine/core'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { ColorSchemeToggle } from './color-scheme-toggle'

afterEach(() => {
  window.localStorage.clear()
})

describe('ColorSchemeToggle', () => {
  it('names the scheme it switches to, and flips after a click', async () => {
    const user = userEvent.setup()
    render(<ColorSchemeToggle />)

    await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }))

    expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })

  it('renders the same label on the server whatever scheme the browser saved', () => {
    window.localStorage.setItem('mantine-color-scheme-value', 'dark')

    const html = renderToString(
      <MantineProvider>
        <ColorSchemeToggle />
      </MantineProvider>,
    )

    expect(html).toContain('aria-label="Switch color theme"')
  })

  it('offers light once mounted when dark was saved', async () => {
    window.localStorage.setItem('mantine-color-scheme-value', 'dark')
    render(<ColorSchemeToggle />)

    expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ColorSchemeToggle />)

    expect(await axe(container)).toHaveNoViolations()
  })
})

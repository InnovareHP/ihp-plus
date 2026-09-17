import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import { routes } from '@/lib/routes'
import { DashboardShell } from './dashboard-shell'

// A literal, not routes.dashboard: vi.hoisted runs before the import it would read.
const nav = vi.hoisted(() => ({ pathname: '/' }))
const auth = vi.hoisted(() => ({ useSignOut: vi.fn() }))

vi.mock('@/features/auth/use-sign-out', () => auth)
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

const USER = { name: 'Dana Reyes', email: 'dana@ihp.example', jobTitle: 'Admissions liaison' }
const ORGANIZATION = { name: 'Innovare Health Partners', role: 'admin' }

function renderShell(props: Partial<Parameters<typeof DashboardShell>[0]> = {}) {
  return render(
    <DashboardShell user={USER} organization={ORGANIZATION} canManageOrganization {...props}>
      <p>Page body</p>
    </DashboardShell>,
  )
}

function group(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) })
}

beforeEach(() => {
  vi.clearAllMocks()
  nav.pathname = routes.dashboard
  auth.useSignOut.mockReturnValue({ isPending: false, mutate: vi.fn() })
})

describe('DashboardShell navigation', () => {
  it('keeps areas folded away until they are asked for', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(group('Requests')).toHaveAttribute('aria-expanded', 'false')
    expect(group('Evaluations')).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the area holding the current page', () => {
    nav.pathname = routes.requestApprovals

    renderShell({ canApproveRequests: true })

    expect(group('Requests')).toHaveAttribute('aria-expanded', 'true')
    expect(group('Evaluations')).toHaveAttribute('aria-expanded', 'false')
    const approvals = screen.getByRole('link', { name: 'Approvals' })
    expect(approvals).toHaveAttribute('aria-current', 'page')
  })

  it('opens and closes an area from the keyboard', async () => {
    const user = userEvent.setup()
    renderShell()

    const requests = group('Requests')
    requests.focus()
    await user.keyboard('{Enter}')

    expect(requests).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'My requests' })).toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(requests).toHaveAttribute('aria-expanded', 'false')
  })

  it('points the disclosure at the panel it opens', async () => {
    const user = userEvent.setup()
    renderShell()

    const requests = group('Requests')
    await user.click(requests)

    const panelId = requests.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    const panel = document.getElementById(panelId as string)
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getByRole('link', { name: 'Forms' })).toBeInTheDocument()
  })

  // `hidden` alone left the links on screen in a real browser: that UA rule loses to Stack's
  // own display, and jsdom loads no Mantine CSS to show it. So the assertion is on the inline
  // style, which is the thing that actually wins in the browser.
  it('really hides a closed area, not just from the accessibility tree', async () => {
    const user = userEvent.setup()
    renderShell()

    const requests = group('Requests')
    const panel = document.getElementById(requests.getAttribute('aria-controls') as string)
    expect(panel?.style.display).toBe('none')

    await user.click(requests)
    expect(panel?.style.display).not.toBe('none')

    await user.click(requests)
    expect(panel?.style.display).toBe('none')
  })

  it('gives an ordinary member a plain row instead of an area with one page', () => {
    renderShell({ canManageOrganization: false, canApproveRequests: false })

    // No Next runtime in jsdom, so the href is the route as written, without the basePath.
    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute('href', routes.requests)
    expect(screen.queryByRole('button', { name: /^Requests/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = renderShell()

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('DashboardShell sidebar controls', () => {
  it('opens and closes the sidebar on a narrow screen', async () => {
    const user = userEvent.setup()
    renderShell()

    const burger = screen.getByRole('button', { name: 'Open navigation' })
    expect(burger).toHaveAttribute('aria-expanded', 'false')

    await user.click(burger)
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('closes the narrow-screen sidebar with Escape', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('folds the permanent sidebar away on a wide screen', async () => {
    const user = userEvent.setup()
    renderShell()

    const toggle = screen.getByRole('button', { name: 'Hide navigation' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Show navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})

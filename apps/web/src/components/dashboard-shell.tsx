'use client'

import { AppShell, Burger, Group, Menu, NavLink, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'
import { ColorSchemeToggle } from './color-scheme-toggle'

const NAV_ITEMS = [
  { href: routes.dashboard, label: 'Dashboard' },
  { href: routes.settings, label: 'Settings' },
] as const

export interface DashboardShellProps {
  user: { name: string; email: string }
  children: ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure(false)
  const pathname = usePathname()
  const router = useRouter()

  // Sign-out is not optimistic: the server clears the cookie and the redirect is the feedback.
  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message ?? 'Sign-out failed')
    },
    onSuccess: () => {
      router.replace(routes.login)
      router.refresh()
    },
    onError: (error: Error) => {
      notifications.show({ color: 'red', autoClose: false, message: error.message })
    },
  })

  return (
    <AppShell
      padding="md"
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={navOpened}
              onClick={toggleNav}
              hiddenFrom="sm"
              size="sm"
              aria-label={navOpened ? 'Close navigation' : 'Open navigation'}
              aria-expanded={navOpened}
              aria-controls="primary-navigation"
            />
            <Text fw={700}>IHP Plus</Text>
          </Group>

          <Group gap="sm">
            <ColorSchemeToggle />
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label={`Account menu for ${user.name}`}>
                  <Text size="sm" fw={500}>
                    {user.name}
                  </Text>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.email}</Menu.Label>
                <Menu.Item component={Link} href={routes.settings}>
                  Settings
                </Menu.Item>
                <Menu.Item
                  color="red"
                  disabled={signOut.isPending}
                  onClick={() => signOut.mutate()}
                >
                  {signOut.isPending ? 'Signing out…' : 'Sign out'}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar id="primary-navigation" p="xs" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            component={Link}
            href={item.href}
            label={item.label}
            active={pathname === item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            onClick={closeNav}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main id="main">{children}</AppShell.Main>
    </AppShell>
  )
}

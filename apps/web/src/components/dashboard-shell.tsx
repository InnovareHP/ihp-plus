'use client'

import {
  AppShell,
  Avatar,
  Burger,
  Group,
  Menu,
  NavLink,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useSignOut } from '@/features/auth/use-sign-out'
import { routes } from '@/lib/routes'
import { AppLogo } from './app-logo'
import { ColorSchemeToggle } from './color-scheme-toggle'

const NAV_ITEMS = [
  { href: routes.dashboard, label: 'Dashboard', description: 'Your day at a glance' },
  { href: routes.members, label: 'Members', description: 'Roles and access', manageOnly: true },
  { href: routes.settings, label: 'Settings', description: 'Profile and account' },
] as const

export interface DashboardShellProps {
  user: { name: string; email: string; jobTitle?: string | null; photoUrl?: string }
  canManageMembers?: boolean
  children: ReactNode
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function DashboardShell({ user, canManageMembers, children }: DashboardShellProps) {
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure(false)
  const pathname = usePathname()
  const signOut = useSignOut()

  return (
    <AppShell
      padding={{ base: 'md', sm: 'lg' }}
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
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
            <AppLogo size={28} />
          </Group>

          <Group gap="sm">
            <ColorSchemeToggle />
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label={`Account menu for ${user.name}`}>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar src={user.photoUrl} alt="" color="brand" radius="xl" size={30}>
                      {initials(user.name)}
                    </Avatar>
                    <Text size="sm" fw={500} visibleFrom="xs">
                      {user.name}
                    </Text>
                  </Group>
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

      <AppShell.Navbar id="primary-navigation" p="sm" aria-label="Primary">
        <AppShell.Section grow>
          <Stack gap={4}>
            {NAV_ITEMS.filter((item) => !('manageOnly' in item) || canManageMembers).map((item) => (
              <NavLink
                key={item.href}
                component={Link}
                href={item.href}
                label={item.label}
                description={item.description}
                active={pathname === item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                onClick={closeNav}
              />
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <UnstyledButton
            component={Link}
            href={routes.settings}
            w="100%"
            p="xs"
            onClick={closeNav}
          >
            <Group gap="sm" wrap="nowrap">
              <Avatar src={user.photoUrl} alt="" color="brand" radius="xl" size={34}>
                {initials(user.name)}
              </Avatar>
              <Stack gap={0} miw={0}>
                <Text size="sm" fw={500} truncate>
                  {user.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {user.jobTitle ?? user.email}
                </Text>
              </Stack>
            </Group>
          </UnstyledButton>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main id="main">{children}</AppShell.Main>
    </AppShell>
  )
}

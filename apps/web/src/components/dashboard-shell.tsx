'use client'

import {
  AppShell,
  Avatar,
  Badge,
  Burger,
  Divider,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure, useHotkeys } from '@mantine/hooks'
import { IconChevronDown, IconLogout, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { RunningClockChip } from '@/features/attendance/components/running-clock-chip'
import { useStopImpersonating } from '@/features/auth/hooks/use-impersonation'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { BulletinUnreadBadge } from '@/features/bulletin/components/bulletin-unread-badge'
import { MentionsMenu } from '@/features/tasks/components/mentions-menu'
import {
  RunningTimerButton,
  RunningTimerChip,
} from '@/features/tasks/components/running-timer-chip'
import { isNavItemActive, visibleSections } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { AppLogo } from './app-logo'
import { ColorSchemeToggle } from './color-scheme-toggle'
import { ImpersonationBanner } from './impersonation-banner'
import { NavGroup } from './nav-group'
import { NavItemLink } from './nav-item-link'

export interface DashboardShellProps {
  user: { name: string; email: string; jobTitle?: string | null; photoUrl?: string }
  organization: { name: string; role?: string }
  canManageOrganization?: boolean
  canApproveRequests?: boolean
  /** True while a portal admin is signed in as this user. */
  impersonating?: boolean
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

export function DashboardShell({
  user,
  organization,
  canManageOrganization = false,
  canApproveRequests = false,
  impersonating = false,
  children,
}: DashboardShellProps) {
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure(false)
  // Wide screens get their own state: the sidebar is permanent there, so without this there
  // is no way to put it away at all.
  const [sidebarShown, { toggle: toggleSidebar }] = useDisclosure(true)
  const pathname = usePathname()
  const signOut = useSignOut()
  const stopImpersonating = useStopImpersonating()
  const sections = visibleSections({ canManageOrganization, canApproveRequests })

  useHotkeys([['Escape', closeNav]])

  return (
    <AppShell
      padding={0}
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !navOpened, desktop: !sidebarShown },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Burger
              opened={navOpened}
              onClick={toggleNav}
              hiddenFrom="sm"
              size="sm"
              aria-label={navOpened ? 'Close navigation' : 'Open navigation'}
              aria-expanded={navOpened}
              aria-controls="primary-navigation"
            />
            <Burger
              opened={sidebarShown}
              onClick={toggleSidebar}
              visibleFrom="sm"
              size="sm"
              aria-label={sidebarShown ? 'Hide navigation' : 'Show navigation'}
              aria-expanded={sidebarShown}
              aria-controls="primary-navigation"
            />
            <AppLogo height={28} />
            <Divider orientation="vertical" my="sm" visibleFrom="sm" />
            <Text size="sm" c="dimmed" truncate visibleFrom="sm">
              {organization.name}
            </Text>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <RunningClockChip />
            <RunningTimerChip />
            <RunningTimerButton />
            <MentionsMenu />
            <ColorSchemeToggle />
            <Menu position="bottom-end" withinPortal shadow="md" width={220}>
              <Menu.Target>
                <UnstyledButton aria-label={`Account menu for ${user.name}`}>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar src={user.photoUrl} alt="" color="brand" radius="xl" size={30}>
                      {initials(user.name)}
                    </Avatar>
                    <Text size="sm" fw={500} visibleFrom="xs">
                      {user.name}
                    </Text>
                    <IconChevronDown size={14} aria-hidden />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.email}</Menu.Label>
                <Menu.Item
                  component={Link}
                  href={routes.settings}
                  leftSection={<IconSettings size={16} aria-hidden />}
                >
                  Settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  disabled={signOut.isPending}
                  leftSection={<IconLogout size={16} aria-hidden />}
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
        <AppShell.Section grow component={ScrollArea} type="scroll">
          <Stack gap="lg">
            {sections.map((section) => (
              <Stack key={section.id} gap={4} component="nav" aria-label={section.label}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="xs" lts="0.04em">
                  {section.label}
                </Text>
                {section.items.map((item) =>
                  item.children ? (
                    <NavGroup
                      key={item.label}
                      item={item}
                      pathname={pathname}
                      onNavigate={closeNav}
                    />
                  ) : (
                    <NavItemLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      description={item.description}
                      icon={item.icon}
                      badge={item.badge === 'bulletinUnread' ? <BulletinUnreadBadge /> : undefined}
                      active={isNavItemActive(pathname, item.href)}
                      onNavigate={closeNav}
                    />
                  ),
                )}
              </Stack>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section pt="sm">
          <Divider mb="sm" />
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
              <Stack gap={0} miw={0} style={{ flex: 1 }}>
                <Text size="sm" fw={500} truncate>
                  {user.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {user.jobTitle ?? user.email}
                </Text>
              </Stack>
              {organization.role ? (
                <Badge size="xs" variant="light" tt="capitalize">
                  {organization.role}
                </Badge>
              ) : null}
            </Group>
          </UnstyledButton>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main id="main">
        {impersonating ? (
          <ImpersonationBanner
            name={user.name}
            isPending={stopImpersonating.isPending}
            onReturn={() => stopImpersonating.mutate()}
          />
        ) : null}
        {children}
      </AppShell.Main>
    </AppShell>
  )
}

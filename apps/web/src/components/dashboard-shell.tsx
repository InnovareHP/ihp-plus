'use client'

import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
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
import { IconLogout, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useStopImpersonating } from '@/features/auth/hooks/use-impersonation'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { BulletinUnreadBadge } from '@/features/bulletin/components/bulletin-unread-badge'
import { SearchLauncher } from '@/features/search/components/search-launcher'
import { recentKey } from '@/features/search/utils/recent-searches'
import { MentionsMenu } from '@/features/tasks/components/mentions-menu'
import { isNavItemActive, visibleSections } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { ActivityButton } from './activity-button'
import { AppLogo } from './app-logo'
import { ColorSchemeMenuItem } from './color-scheme-menu-item'
import classes from './dashboard-shell.module.css'
import touch from './touch-target.module.css'
import { ImpersonationBanner } from './impersonation-banner'
import { NavGroup } from './nav-group'
import { NavItemLink } from './nav-item-link'

export interface DashboardShellProps {
  user: { id: string; name: string; email: string; jobTitle?: string | null; photoUrl?: string }
  organization: { id: string; name: string; role?: string }
  canManageOrganization?: boolean
  canApproveRequests?: boolean
  canManageHiring?: boolean
  canViewWebsites?: boolean
  /** True while a portal admin is signed in as this user. */
  impersonating?: boolean
  children: ReactNode
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1)
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
  canManageHiring = false,
  canViewWebsites = false,
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
  const sections = visibleSections({
    canManageOrganization,
    canApproveRequests,
    canManageHiring,
    canViewWebsites,
  })

  useHotkeys([['Escape', closeNav]])

  return (
    <AppShell
      padding={0}
      header={{ height: 60 }}
      navbar={{
        // At 768 px a 300 px sidebar took 40% of the screen.
        width: { sm: 260, lg: 300 },
        breakpoint: 'sm',
        collapsed: { mobile: !navOpened, desktop: !sidebarShown },
      }}
    >
      <AppShell.Header className={classes.header}>
        <Group h="100%" px={{ base: 'sm', sm: 'md' }} justify="space-between" wrap="nowrap">
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
            <Divider orientation="vertical" my="sm" visibleFrom="md" />
            <Text size="sm" c="dimmed" truncate visibleFrom="md">
              {organization.name}
            </Text>
          </Group>

          <Group gap="xs" wrap="nowrap">
            {/* The time comes first in the DOM, as a phone shows it; from laptop width CSS puts search first. */}
            <ActivityButton />
            {/* Admins only while search is piloted with them before everyone gets it. */}
            {canManageOrganization ? (
              <Box className={classes.search}>
                <SearchLauncher
                  sections={sections}
                  storageKey={recentKey(organization.id, user.id)}
                  persistRecent={!impersonating}
                />
              </Box>
            ) : null}
            <MentionsMenu />
            {/* The photo alone opens the menu; the name lives inside it, so the header stays slim. */}
            <Menu position="bottom-end" withinPortal shadow="md" width={240}>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  radius="xl"
                  size="lg"
                  className={touch.target}
                  aria-label={`Account menu for ${user.name}`}
                >
                  <Avatar
                    src={user.photoUrl}
                    alt=""
                    color="brand"
                    radius="xl"
                    size={26}
                    className={classes.avatar}
                  >
                    {initials(user.name)}
                  </Avatar>
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Stack gap={0} px="sm" py="xs">
                  <Text size="sm" fw={600} truncate>
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {user.email}
                  </Text>
                  {organization.role || user.jobTitle ? (
                    <Text size="xs" c="dimmed" truncate>
                      {[organization.role && capitalize(organization.role), user.jobTitle]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </Stack>
                <Menu.Divider />
                <Menu.Item
                  component={Link}
                  href={routes.settings}
                  leftSection={<IconSettings size={16} aria-hidden />}
                >
                  Settings
                </Menu.Item>
                <ColorSchemeMenuItem />
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
          <Stack gap="md">
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
            className={classes.profile}
            onClick={closeNav}
          >
            <Group gap="sm" wrap="nowrap">
              <Avatar
                src={user.photoUrl}
                alt=""
                color="brand"
                radius="xl"
                size={32}
                className={classes.avatar}
              >
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
              {/* Outline, because the light brand badge's text fell short of AA on the dark body. */}
              {organization.role ? (
                <Badge size="xs" variant="outline" tt="capitalize">
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

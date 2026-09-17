'use client'

import { NavLink, Stack } from '@mantine/core'
import { IconChevronDown } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { isGroupOpen, isNavItemActive, type NavItem } from '@/lib/navigation'
import { NavItemLink } from './nav-item-link'

export interface NavGroupProps {
  item: NavItem
  pathname: string
  onNavigate: () => void
}

export function NavGroup({ item, pathname, onNavigate }: NavGroupProps) {
  const panelId = useId()
  // The open state follows the page by default; a toggle only overrides the page it was made
  // on, so walking into another area opens that one instead of honouring a stale click.
  const [override, setOverride] = useState<{ pathname: string; opened: boolean } | null>(null)
  const opened = override?.pathname === pathname ? override.opened : isGroupOpen(pathname, item)
  const children = item.children ?? []

  return (
    <>
      <NavLink
        component="button"
        type="button"
        label={item.label}
        title={item.description}
        leftSection={<item.icon size={18} stroke={1.6} aria-hidden />}
        rightSection={
          <IconChevronDown
            size={14}
            aria-hidden
            style={{ transform: opened ? 'rotate(180deg)' : undefined }}
          />
        }
        // Not `active`: the group is a disclosure, and the page inside it owns the highlight.
        aria-expanded={opened}
        aria-controls={panelId}
        onClick={() => setOverride({ pathname, opened: !opened })}
      />
      {/* Always rendered so aria-controls points at something. `hidden` alone would not hide
          it: that UA rule loses to Stack's own display, so the inline display goes with it.
          Hidden rather than animated — a sidebar that slides is motion under a click the user
          is about to make. */}
      <Stack gap={2} pl="lg" id={panelId} hidden={!opened} display={opened ? undefined : 'none'}>
        {children.map((child) => (
          <NavItemLink
            key={child.href}
            href={child.href}
            label={child.label}
            description={child.description}
            active={isNavItemActive(pathname, child.href)}
            onNavigate={onNavigate}
          />
        ))}
      </Stack>
    </>
  )
}

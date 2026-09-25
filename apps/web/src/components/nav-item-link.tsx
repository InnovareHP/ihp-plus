'use client'

import { NavLink } from '@mantine/core'
import Link from 'next/link'
import type { Icon } from '@tabler/icons-react'
import type { ReactNode } from 'react'

export interface NavItemLinkProps {
  href: string
  label: string
  /** Named for a screen reader and shown on hover; the row itself stays one line. */
  description: string
  icon?: Icon
  /** A count or marker after the label, such as unread posts. */
  badge?: ReactNode
  active: boolean
  onNavigate: () => void
}

export function NavItemLink({
  href,
  label,
  description,
  icon: ItemIcon,
  badge,
  active,
  onNavigate,
}: NavItemLinkProps) {
  return (
    <NavLink
      component={Link}
      href={href}
      label={label}
      title={description}
      leftSection={ItemIcon ? <ItemIcon size={18} stroke={1.6} aria-hidden /> : undefined}
      rightSection={badge}
      active={active}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    />
  )
}

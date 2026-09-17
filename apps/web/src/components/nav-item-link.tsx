'use client'

import { NavLink } from '@mantine/core'
import Link from 'next/link'
import type { Icon } from '@tabler/icons-react'

export interface NavItemLinkProps {
  href: string
  label: string
  /** Named for a screen reader and shown on hover; the row itself stays one line. */
  description: string
  icon?: Icon
  active: boolean
  onNavigate: () => void
}

export function NavItemLink({
  href,
  label,
  description,
  icon: ItemIcon,
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
      active={active}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    />
  )
}

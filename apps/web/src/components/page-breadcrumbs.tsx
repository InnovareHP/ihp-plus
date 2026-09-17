'use client'

import { Anchor, Breadcrumbs, Text } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import Link from 'next/link'
import type { Crumb } from '@/lib/navigation'

// A client leaf: Mantine's component={Link} cannot cross the RSC boundary.
export function PageBreadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      separator={<IconChevronRight size={14} aria-hidden />}
      separatorMargin="xs"
      fz="sm"
    >
      {items.map((crumb) =>
        crumb.href ? (
          <Anchor key={crumb.label} component={Link} href={crumb.href} size="sm" c="dimmed">
            {crumb.label}
          </Anchor>
        ) : (
          <Text key={crumb.label} size="sm" c="dimmed" aria-current="page">
            {crumb.label}
          </Text>
        ),
      )}
    </Breadcrumbs>
  )
}

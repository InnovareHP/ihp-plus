'use client'

import { Anchor, Breadcrumbs, Text } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import Link from 'next/link'
import { libraryHref } from '../hooks/use-library-query'
import type { LibraryQuery } from '../schema'
import { libraryTrail } from '../utils/library-path'

export interface LibraryTrailProps {
  pathname: string
  query: LibraryQuery
}

/** Where in the library the user is, with every ancestor one click away. */
export function LibraryTrail({ pathname, query }: LibraryTrailProps) {
  const crumbs = libraryTrail(query.path)

  return (
    <Breadcrumbs
      aria-label="Library folders"
      separator={<IconChevronRight size={14} aria-hidden />}
      separatorMargin="xs"
      fz="sm"
    >
      {crumbs.map((crumb, index) =>
        index === crumbs.length - 1 ? (
          <Text key={crumb.path} size="sm" fw={500} aria-current="page">
            {crumb.label}
          </Text>
        ) : (
          <Anchor
            key={crumb.path}
            component={Link}
            href={libraryHref(pathname, { ...query, path: crumb.path })}
            size="sm"
            c="dimmed"
          >
            {crumb.label}
          </Anchor>
        ),
      )}
    </Breadcrumbs>
  )
}

'use client'

import { Anchor, Group, Text, ThemeIcon } from '@mantine/core'
import { IconFolder } from '@tabler/icons-react'
import Link from 'next/link'
import { fileLook } from '@/lib/file-look'
import type { LibraryEntry } from '../schema'

export interface LibraryEntryNameProps {
  entry: LibraryEntry
  /** Where opening this folder leads; a file row has nowhere to go. */
  href: string | undefined
}

/** A folder navigates, a file does not — the icon says which before the name is read. */
export function LibraryEntryName({ entry, href }: LibraryEntryNameProps) {
  const look = entry.isFolder
    ? { Icon: IconFolder, color: 'brand' }
    : fileLook(entry.contentType ?? '')

  return (
    <Group gap="xs" wrap="nowrap" miw={0}>
      <ThemeIcon variant="light" color={look.color} size="md" aria-hidden>
        <look.Icon size={16} />
      </ThemeIcon>
      {href ? (
        <Anchor component={Link} href={href} size="sm" fw={500} lineClamp={1}>
          {entry.name}
        </Anchor>
      ) : (
        <Text size="sm" fw={500} lineClamp={1}>
          {entry.name}
        </Text>
      )}
    </Group>
  )
}

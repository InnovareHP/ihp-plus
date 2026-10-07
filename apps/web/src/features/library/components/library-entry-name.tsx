'use client'

import { Anchor, Avatar, Group, Text, ThemeIcon } from '@mantine/core'
import { IconFolder } from '@tabler/icons-react'
import Link from 'next/link'
import { fileLook } from '@/lib/file-look'
import type { LibraryEntry } from '../schema'
import { isPreviewableImage, libraryFileUrl } from '../utils/library-file'

export interface LibraryEntryNameProps {
  entry: LibraryEntry
  /** Where opening this folder leads; a file row has nowhere to go. */
  href: string | undefined
  /** Set for an image, which opens in the preview instead of downloading. */
  onPreview?: () => void
}

/** A folder navigates, a file does not — the icon says which before the name is read. */
export function LibraryEntryName({ entry, href, onPreview }: LibraryEntryNameProps) {
  const look = entry.isFolder
    ? { Icon: IconFolder, color: 'brand' }
    : fileLook(entry.contentType ?? '')
  const icon = <look.Icon size={16} />

  return (
    <Group gap="xs" wrap="nowrap" miw={0}>
      {isPreviewableImage(entry.contentType) ? (
        // Avatar falls back to the icon when SharePoint has no thumbnail to give.
        <Avatar
          src={libraryFileUrl(entry, 'thumbnail')}
          alt=""
          size={28}
          radius="sm"
          color={look.color}
          imageProps={{ loading: 'lazy' }}
          aria-hidden
        >
          {icon}
        </Avatar>
      ) : (
        <ThemeIcon variant="light" color={look.color} size="md" aria-hidden>
          {icon}
        </ThemeIcon>
      )}
      {href ? (
        <Anchor component={Link} href={href} size="sm" fw={500} lineClamp={1}>
          {entry.name}
        </Anchor>
      ) : onPreview ? (
        <Anchor
          component="button"
          type="button"
          onClick={onPreview}
          size="sm"
          fw={500}
          lineClamp={1}
        >
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

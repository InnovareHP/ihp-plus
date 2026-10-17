'use client'

import { Avatar, Badge, Box, Group, Highlight, Text, ThemeIcon } from '@mantine/core'
import { Spotlight } from '@mantine/spotlight'
import { IconFile, type Icon } from '@tabler/icons-react'
import type { SearchEntry } from '../schema'
import classes from './search-palette.module.css'

export interface SearchResultProps {
  entry: SearchEntry
  query: string
  icon?: Icon
  onOpen: (entry: SearchEntry) => void
}

export function SearchResult({
  entry,
  query,
  icon: ResultIcon = IconFile,
  onOpen,
}: SearchResultProps) {
  return (
    <Spotlight.Action
      className={classes.action}
      // The highlight's <mark> splits the label, which can run words together in the computed name.
      aria-label={[entry.label, entry.description, entry.area].filter(Boolean).join(', ')}
      onClick={() => onOpen(entry)}
    >
      <Group wrap="nowrap" gap="sm" w="100%">
        {entry.kind === 'person' ? (
          // Decorative: the name is read from the label, so the initials would only repeat it.
          <Avatar
            src={entry.photoUrl}
            name={entry.label}
            color="brand"
            size={36}
            alt=""
            aria-hidden
          />
        ) : (
          <ThemeIcon variant="light" size={36} radius="md" aria-hidden>
            <ResultIcon size={18} />
          </ThemeIcon>
        )}
        <Box miw={0} flex={1}>
          <Highlight highlight={query.trim()} size="sm" fw={600} truncate>
            {entry.label}
          </Highlight>
          {entry.description ? (
            <Text size="xs" c="dimmed" truncate>
              {entry.description}
            </Text>
          ) : null}
        </Box>
        {entry.area ? (
          // A status colour is user-chosen, so it only tints the dot; the text keeps body contrast.
          <Badge
            variant="default"
            size="sm"
            radius="sm"
            tt="none"
            maw={140}
            leftSection={
              entry.areaColor ? (
                <Box w={8} h={8} bg={entry.areaColor} aria-hidden style={{ borderRadius: '50%' }} />
              ) : undefined
            }
          >
            {entry.area}
          </Badge>
        ) : null}
      </Group>
    </Spotlight.Action>
  )
}

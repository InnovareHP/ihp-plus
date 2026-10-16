'use client'

import { Badge, Box, Group, Highlight, Text, ThemeIcon } from '@mantine/core'
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
    <Spotlight.Action className={classes.action} onClick={() => onOpen(entry)}>
      <Group wrap="nowrap" gap="sm" w="100%">
        <ThemeIcon variant="light" size={36} radius="md" aria-hidden>
          <ResultIcon size={18} />
        </ThemeIcon>
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
          <Badge variant="default" size="sm" radius="sm" tt="none" maw={140}>
            {entry.area}
          </Badge>
        ) : null}
      </Group>
    </Spotlight.Action>
  )
}

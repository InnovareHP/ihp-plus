'use client'

import { CloseButton, Group, Kbd, Modal, Text, VisuallyHidden } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Spotlight } from '@mantine/spotlight'
import { IconSearch } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { track } from '@/lib/analytics'
import type { NavSection } from '@/lib/navigation'
import { PAGE_TABS } from '@/lib/page-tabs'
import { searchEvents } from '../events'
import type { SearchEntry } from '../schema'
import { searchSpotlight, searchStore } from '../spotlight-store'
import { useRecentSearches } from '../hooks/use-recent-searches'
import { useSearchDirectory } from '../hooks/use-search-directory'
import { clientEntries, personEntries } from '../utils/directory-entries'
import { pageEntries } from '../utils/page-entries'
import { iconFor, pageIcons } from '../utils/page-icons'
import { rankEntries } from '../utils/rank'
import { DirectoryStatus } from './directory-status'
import classes from './search-palette.module.css'
import { SearchResult } from './search-result'

const PAGE_LIMIT = 5
const GROUP_LIMIT = 5
const SUGGESTION_LIMIT = 6

export interface SearchPaletteProps {
  sections: readonly NavSection[]
  storageKey: string
  /** Off while impersonating, so an admin's clicks never land in the member's recent list. */
  persistRecent: boolean
}

export function SearchPalette({ sections, storageKey, persistRecent }: SearchPaletteProps) {
  const router = useRouter()
  // The search box is a form field like any other, so react-hook-form owns it rather than useState.
  const { control, setValue, reset } = useForm<{ query: string }>({ defaultValues: { query: '' } })
  const query = useWatch({ control, name: 'query' })
  const trimmed = query.trim()
  const narrow = useMediaQuery('(max-width: 48em)')
  const recent = useRecentSearches(storageKey)
  const icons = pageIcons(sections)
  const pages = pageEntries(sections, PAGE_TABS)
  // Loaded once on open and filtered locally, so typing a name never waits on the network.
  const directory = useSearchDirectory()
  const people = directory.data ? personEntries(directory.data.people) : []
  const clients = directory.data ? clientEntries(directory.data.clients) : []
  const pageHits = rankEntries(pages, query, PAGE_LIMIT)
  const peopleHits = rankEntries(people, query, GROUP_LIMIT)
  const clientHits = rankEntries(clients, query, GROUP_LIMIT)
  const total = pageHits.length + peopleHits.length + clientHits.length
  const directoryState = directory.isPending ? 'loading' : directory.isError ? 'error' : null
  const recentIds = new Set(recent.entries.map((entry) => entry.id))
  const suggestions = pages.filter((page) => !recentIds.has(page.id)).slice(0, SUGGESTION_LIMIT)

  function open(entry: SearchEntry, position: number) {
    if (persistRecent) recent.remember(entry)
    track(searchEvents.resultOpened, { kind: entry.kind, position })
    router.push(entry.href)
  }

  function group(label: string, entries: readonly SearchEntry[]) {
    return (
      // The visible label is CSS generated content, so the group carries its own name for screen readers.
      <Spotlight.ActionsGroup label={label} role="group" aria-label={label}>
        {entries.map((entry, index) => (
          <SearchResult
            key={entry.id}
            entry={entry}
            query={trimmed}
            icon={iconFor(icons, entry.href)}
            onOpen={(one) => open(one, index)}
          />
        ))}
      </Spotlight.ActionsGroup>
    )
  }

  return (
    <Spotlight.Root
      store={searchStore}
      shortcut={null}
      query={query}
      onQueryChange={(value) => setValue('query', value)}
      onSpotlightClose={() => reset()}
      classNames={{ content: classes.content }}
      fullScreen={narrow}
      size={640}
      radius="lg"
      scrollable
      maxHeight={narrow ? 'calc(100dvh - 120px)' : 440}
    >
      {/* Mounting a title is what gives the dialog its accessible name. */}
      <VisuallyHidden>
        <Modal.Title>Search</Modal.Title>
      </VisuallyHidden>
      <Spotlight.Search
        aria-label="Search pages, people and clients"
        placeholder="Search pages, people and clients…"
        size="lg"
        leftSection={<IconSearch size={20} aria-hidden />}
        rightSectionPointerEvents="all"
        rightSection={<CloseButton aria-label="Close search" onClick={searchSpotlight.close} />}
      />
      <Spotlight.ActionsList px="xs" pb="xs">
        {trimmed ? (
          <>
            {pageHits.length > 0 ? group('Pages', pageHits) : null}
            {peopleHits.length > 0 ? group('People', peopleHits) : null}
            {clientHits.length > 0 ? group('Clients', clientHits) : null}
            {directoryState ? (
              <DirectoryStatus state={directoryState} onRetry={() => void directory.refetch()} />
            ) : null}
            {total === 0 && !directoryState ? (
              <Spotlight.Empty>
                Nothing matches “{trimmed}”. Try a shorter or different word.
              </Spotlight.Empty>
            ) : null}
          </>
        ) : (
          <>
            {recent.entries.length > 0 ? group('Recent', recent.entries) : null}
            {group('Pages', suggestions)}
          </>
        )}
      </Spotlight.ActionsList>
      {narrow ? null : (
        <Group className={classes.footer} gap="lg" px="md" py="xs" aria-hidden>
          <Text size="xs" c="dimmed">
            <Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> to move
          </Text>
          <Text size="xs" c="dimmed">
            <Kbd size="xs">↵</Kbd> to open
          </Text>
          <Text size="xs" c="dimmed">
            <Kbd size="xs">Esc</Kbd> to close
          </Text>
        </Group>
      )}
      <VisuallyHidden role="status" aria-live="polite">
        {trimmed && directoryState !== 'loading'
          ? `${total} ${total === 1 ? 'result' : 'results'}`
          : ''}
      </VisuallyHidden>
    </Spotlight.Root>
  )
}

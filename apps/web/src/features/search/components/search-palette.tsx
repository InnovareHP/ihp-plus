'use client'

import {
  CloseButton,
  Group,
  Kbd,
  Modal,
  Text,
  VisuallyHidden,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Spotlight } from '@mantine/spotlight'
import { IconSearch } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { track } from '@/lib/analytics'
import type { NavSection } from '@/lib/navigation'
import { PAGE_TABS } from '@/lib/page-tabs'
import { routes } from '@/lib/routes'
import { useAvailableForms } from '@/features/requests/hooks/use-requests'
import { searchEvents } from '../events'
import type { SearchEntry } from '../schema'
import { searchSpotlight, searchStore } from '../spotlight-store'
import { useRecentSearches } from '../hooks/use-recent-searches'
import { useSearchDirectory } from '../hooks/use-search-directory'
import { useTaskSearch } from '../hooks/use-task-search'
import { actionEntries, THEME_ACTION_ID } from '../utils/action-entries'
import { clientEntries, personEntries } from '../utils/directory-entries'
import { parseQuery, SCOPE_PREFIXES, type SearchScope } from '../utils/parse-query'
import { taskEntries } from '../utils/task-entries'
import { pageEntries } from '../utils/page-entries'
import { iconFor, pageIcons } from '../utils/page-icons'
import { rankEntries } from '../utils/rank'
import { GroupStatus } from './group-status'
import { ScopeChips } from './scope-chips'
import classes from './search-palette.module.css'
import { SearchResult } from './search-result'

const PAGE_LIMIT = 5
const GROUP_LIMIT = 5
const SUGGESTION_LIMIT = 6
const ACTION_SUGGESTIONS = 4

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
  // A leading @, $, #, / or > narrows the search to one kind; the rest is what to match.
  const { scope, text } = parseQuery(query)
  const searching = scope !== null || text.length > 0
  const inScope = (kind: SearchScope) => scope === null || scope === kind
  const searchRef = useRef<HTMLInputElement>(null)
  const scopeLabel =
    SCOPE_PREFIXES.find((one) => one.scope === scope)?.label.toLowerCase() ?? 'results'
  const narrow = useMediaQuery('(max-width: 48em)')
  // A tablet is wide but still driven by fingers, so its targets need the larger size too.
  const coarse = useMediaQuery('(pointer: coarse)')
  const touch = Boolean(narrow || coarse)
  const recent = useRecentSearches(storageKey)
  const icons = pageIcons(sections)
  const pages = pageEntries(sections, PAGE_TABS)
  const { setColorScheme } = useMantineColorScheme()
  const nextTheme = useComputedColorScheme('light') === 'dark' ? 'light' : 'dark'
  const visibleHrefs = new Set(pages.map((page) => page.href))
  // Asked for only when Requests is in the sidebar; a failed load only drops those shortcuts.
  const forms = useAvailableForms(visibleHrefs.has(routes.requests))
  const actions = actionEntries({
    visibleHrefs,
    forms: forms.data ?? [],
    nextTheme,
  })
  const actionHits = inScope('actions') ? rankEntries(actions, text, GROUP_LIMIT) : []
  // Loaded once on open and filtered locally, so typing a name never waits on the network.
  const directory = useSearchDirectory()
  const people = directory.data ? personEntries(directory.data.people) : []
  const clients = directory.data ? clientEntries(directory.data.clients) : []
  const pageHits = inScope('pages') ? rankEntries(pages, text, PAGE_LIMIT) : []
  const peopleHits = inScope('people') ? rankEntries(people, text, GROUP_LIMIT) : []
  const clientHits = inScope('clients') ? rankEntries(clients, text, GROUP_LIMIT) : []
  // Outside the tasks scope no task is asked for at all, which spares the server a request.
  const taskSearch = useTaskSearch(inScope('tasks') ? text : '')
  // Tasks are too many to list, so "#" alone asks for a name or number instead.
  const taskHint = scope === 'tasks' && text.length < 2
  const taskHits = taskEntries(taskSearch.tasks).slice(0, GROUP_LIMIT)
  const total =
    actionHits.length + pageHits.length + peopleHits.length + clientHits.length + taskHits.length
  const wantsDirectory = inScope('people') || inScope('clients')
  const directoryState = !wantsDirectory
    ? null
    : directory.isPending
      ? 'loading'
      : directory.isError
        ? 'error'
        : null
  const taskState = taskSearch.isLoading ? 'loading' : taskSearch.isError ? 'error' : null
  const settling = Boolean(
    directoryState === 'loading' || taskState === 'loading' || taskSearch.isWaiting,
  )
  const recentIds = new Set(recent.entries.map((entry) => entry.id))
  const suggestions = pages.filter((page) => !recentIds.has(page.id)).slice(0, SUGGESTION_LIMIT)

  function open(entry: SearchEntry, position: number) {
    track(searchEvents.resultOpened, { kind: entry.kind, position })
    if (entry.id === THEME_ACTION_ID) {
      setColorScheme(nextTheme)
      return
    }
    // Recent is for places; an action is one step of work, not somewhere to return to.
    if (persistRecent && entry.kind !== 'action') recent.remember(entry)
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
            query={text}
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
      fullScreen={narrow}
      size={640}
      radius="lg"
    >
      {/* Mounting a title is what gives the dialog its accessible name. */}
      <VisuallyHidden>
        <Modal.Title>Search</Modal.Title>
      </VisuallyHidden>
      <Spotlight.Search
        aria-label="Search pages, people, clients and tasks"
        // The chips already name the kinds, and the long hint was cut off on a phone.
        placeholder={
          narrow
            ? 'Search everything'
            : 'Search pages, people, clients and tasks — or type @ for people'
        }
        size="lg"
        leftSection={<IconSearch size={20} aria-hidden />}
        rightSectionPointerEvents="all"
        rightSection={<CloseButton aria-label="Close search" onClick={searchSpotlight.close} />}
        ref={searchRef}
      />
      <ScopeChips
        scope={scope}
        touch={touch}
        onPick={(symbol) => {
          setValue('query', `${symbol}${text}`)
          searchRef.current?.focus()
        }}
        onClear={() => {
          setValue('query', text)
          searchRef.current?.focus()
        }}
      />
      {/* A ceiling, not a fixed height: the list shrinks to a few results and scrolls past many. */}
      <Spotlight.ActionsList
        px="xs"
        pb="xs"
        mah={narrow ? 'calc(100dvh - 140px)' : 'min(440px, calc(100dvh - 320px))'}
      >
        {searching ? (
          <>
            {actionHits.length > 0 ? group('Actions', actionHits) : null}
            {pageHits.length > 0 ? group('Pages', pageHits) : null}
            {peopleHits.length > 0 ? group('People', peopleHits) : null}
            {clientHits.length > 0 ? group('Clients', clientHits) : null}
            {directoryState ? (
              <GroupStatus
                subject="people and clients"
                state={directoryState}
                onRetry={() => void directory.refetch()}
              />
            ) : null}
            {taskHits.length > 0 ? group('Tasks', taskHits) : null}
            {taskState ? (
              <GroupStatus subject="tasks" state={taskState} rows={1} onRetry={taskSearch.retry} />
            ) : null}
            {taskHint ? (
              <Text size="sm" c="dimmed" px="md" py="sm">
                Type a task name, or a number like 12.
              </Text>
            ) : null}
            {total === 0 && !taskHint && !settling && !directoryState && !taskState ? (
              <Spotlight.Empty>
                {text
                  ? `Nothing matches “${text}”. Try a shorter or different word.`
                  : `No ${scopeLabel} to show yet.`}
              </Spotlight.Empty>
            ) : null}
          </>
        ) : (
          <>
            {group('Actions', actions.slice(0, ACTION_SUGGESTIONS))}
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
        {searching && !settling ? `${total} ${total === 1 ? 'result' : 'results'}` : ''}
      </VisuallyHidden>
    </Spotlight.Root>
  )
}

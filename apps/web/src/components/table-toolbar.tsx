'use client'

import {
  Badge,
  Button,
  CloseButton,
  Drawer,
  Group,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedCallback, useDisclosure } from '@mantine/hooks'
import { IconFilter, IconSearch } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'

export interface FilterOption {
  value: string
  label: string
}

/**
 * One advanced filter. Declarative rather than a slot, so every list gets the same drawer,
 * the same chips and the same clearing behaviour without writing any of it again.
 */
export type FilterControl =
  | { kind: 'multi'; key: string; label: string; options: readonly FilterOption[]; help?: string }
  | { kind: 'select'; key: string; label: string; options: readonly FilterOption[]; help?: string }
  | { kind: 'toggle'; key: string; label: string; help?: string }
  | { kind: 'dateRange'; fromKey: string; toKey: string; label: string; help?: string }

export interface TableToolbarProps<TQuery extends Record<string, unknown>> {
  /** What the rows are, e.g. "departments" — it names the search box and the drawer. */
  label: string
  query: TQuery
  setQuery: (patch: Partial<TQuery>) => void
  clearFilters: () => void
  /** The query key the search box writes to. */
  searchKey?: string
  filters?: readonly FilterControl[]
  /** The list's primary action, kept on the same line as the search. */
  action?: ReactNode
}

interface Chip {
  id: string
  label: string
  clear: () => void
}

export function TableToolbar<TQuery extends Record<string, unknown>>({
  label,
  query,
  setQuery,
  clearFilters,
  searchKey = 'search',
  filters = [],
  action,
}: TableToolbarProps<TQuery>) {
  const [opened, drawer] = useDisclosure(false)
  const chips = chipsOf(filters, query, setQuery)

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <SearchField
          label={label}
          initial={stringOf(query[searchKey])}
          onSearch={(value) => setQuery({ [searchKey]: value } as Partial<TQuery>)}
        />

        <Group gap="sm">
          {filters.length > 0 ? (
            <Button
              variant="default"
              leftSection={<IconFilter size={16} aria-hidden />}
              // The count is in the name rather than a decorative dot, so it is announced
              // instead of only seen.
              aria-label={chips.length > 0 ? `Filters, ${chips.length} applied` : 'Filters'}
              aria-haspopup="dialog"
              aria-expanded={opened}
              rightSection={
                chips.length > 0 ? (
                  <Badge size="sm" circle variant="filled" aria-hidden>
                    {chips.length}
                  </Badge>
                ) : undefined
              }
              onClick={drawer.open}
            >
              Filters
            </Button>
          ) : null}
          {action}
        </Group>
      </Group>

      {chips.length > 0 ? (
        <Group gap="xs" wrap="wrap">
          <Text size="sm" c="dimmed">
            Filtered by
          </Text>
          {chips.map((chip) => (
            <Badge
              key={chip.id}
              variant="light"
              size="lg"
              rightSection={
                <CloseButton
                  size="xs"
                  variant="transparent"
                  aria-label={`Remove the ${chip.label} filter`}
                  onClick={chip.clear}
                />
              }
            >
              {chip.label}
            </Badge>
          ))}
          <Button variant="subtle" size="compact-sm" onClick={clearFilters}>
            Clear all
          </Button>
        </Group>
      ) : null}

      <Drawer
        opened={opened}
        onClose={drawer.close}
        position="right"
        size="md"
        title={`Filter ${label}`}
      >
        <Stack gap="lg">
          <Stack gap="md">
            {filters.map((filter) => (
              <FilterField
                key={filter.kind === 'dateRange' ? filter.fromKey : filter.key}
                filter={filter}
                query={query}
                setQuery={setQuery}
              />
            ))}
          </Stack>

          <Group justify="space-between">
            <Button
              variant="subtle"
              color="gray"
              onClick={clearFilters}
              disabled={chips.length === 0}
            >
              Clear all
            </Button>
            <Button onClick={drawer.close}>Show results</Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  )
}

function SearchField({
  label,
  initial,
  onSearch,
}: {
  label: string
  initial: string
  onSearch: (value: string) => void
}) {
  // A search box is a form field like any other, so react-hook-form owns it rather than
  // useState; the debounced write to the URL hangs off the same change event.
  const { register } = useForm<{ search: string }>({ defaultValues: { search: initial } })
  const field = register('search')
  const commit = useDebouncedCallback(onSearch, 300)

  return (
    <TextInput
      {...field}
      onChange={(event) => {
        void field.onChange(event)
        commit(event.currentTarget.value)
      }}
      type="search"
      aria-label={`Search ${label}`}
      placeholder={`Search ${label}`}
      leftSection={<IconSearch size={16} aria-hidden />}
      w={{ base: '100%', sm: 280 }}
    />
  )
}

function FilterField<TQuery extends Record<string, unknown>>({
  filter,
  query,
  setQuery,
}: {
  filter: FilterControl
  query: TQuery
  setQuery: (patch: Partial<TQuery>) => void
}) {
  const patch = (value: Partial<Record<string, unknown>>) => setQuery(value as Partial<TQuery>)

  switch (filter.kind) {
    case 'multi':
      return (
        <MultiSelect
          label={filter.label}
          description={filter.help}
          data={[...filter.options]}
          value={arrayOf(query[filter.key])}
          onChange={(value) => patch({ [filter.key]: value })}
          searchable={filter.options.length > 8}
          clearable
          placeholder={arrayOf(query[filter.key]).length === 0 ? 'Any' : undefined}
        />
      )

    case 'select':
      return (
        <Select
          label={filter.label}
          description={filter.help}
          data={[...filter.options]}
          value={stringOf(query[filter.key]) || null}
          onChange={(value) => patch({ [filter.key]: value ?? '' })}
          placeholder="Any"
          clearable
        />
      )

    case 'toggle':
      return (
        <Switch
          label={filter.label}
          description={filter.help}
          checked={Boolean(query[filter.key])}
          onChange={(event) => patch({ [filter.key]: event.currentTarget.checked })}
        />
      )

    case 'dateRange':
    default:
      return (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {filter.label}
          </Text>
          {filter.help ? (
            <Text size="xs" c="dimmed">
              {filter.help}
            </Text>
          ) : null}
          <Group grow>
            <TextInput
              type="date"
              aria-label={`${filter.label}, from`}
              value={stringOf(query[filter.fromKey])}
              onChange={(event) => patch({ [filter.fromKey]: event.currentTarget.value })}
            />
            <TextInput
              type="date"
              aria-label={`${filter.label}, to`}
              value={stringOf(query[filter.toKey])}
              onChange={(event) => patch({ [filter.toKey]: event.currentTarget.value })}
            />
          </Group>
        </Stack>
      )
  }
}

function stringOf(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function arrayOf(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function labelOf(options: readonly FilterOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

// One chip per applied value, so removing a single choice never means reopening the drawer.
function chipsOf<TQuery extends Record<string, unknown>>(
  filters: readonly FilterControl[],
  query: TQuery,
  setQuery: (patch: Partial<TQuery>) => void,
): Chip[] {
  const chips: Chip[] = []
  const patch = (value: Partial<Record<string, unknown>>) => setQuery(value as Partial<TQuery>)

  for (const filter of filters) {
    if (filter.kind === 'multi') {
      for (const value of arrayOf(query[filter.key])) {
        chips.push({
          id: `${filter.key}:${value}`,
          label: labelOf(filter.options, value),
          clear: () =>
            patch({ [filter.key]: arrayOf(query[filter.key]).filter((item) => item !== value) }),
        })
      }
      continue
    }

    if (filter.kind === 'select') {
      const value = stringOf(query[filter.key])
      if (value) {
        chips.push({
          id: filter.key,
          label: labelOf(filter.options, value),
          clear: () => patch({ [filter.key]: '' }),
        })
      }
      continue
    }

    if (filter.kind === 'toggle') {
      if (query[filter.key]) {
        chips.push({
          id: filter.key,
          label: filter.label,
          clear: () => patch({ [filter.key]: false }),
        })
      }
      continue
    }

    const from = stringOf(query[filter.fromKey])
    const to = stringOf(query[filter.toKey])
    if (from || to) {
      chips.push({
        id: filter.fromKey,
        label: from && to ? `${filter.label} ${from} to ${to}` : `${filter.label} ${from || to}`,
        clear: () => patch({ [filter.fromKey]: '', [filter.toKey]: '' }),
      })
    }
  }

  return chips
}

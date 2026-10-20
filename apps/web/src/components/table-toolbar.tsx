'use client'

import { Badge, Box, Button, CloseButton, Drawer, Group, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconFilter } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { chipsOf, stringOf } from '@/lib/table-filters'
import { FilterField } from './filter-field'
import { SearchField } from './search-field'
import classes from './table-toolbar.module.css'

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
  | {
      kind: 'select'
      key: string
      label: string
      options: readonly FilterOption[]
      help?: string
      /** The value that means "no filter" when the schema's default is not empty, e.g. "all". */
      none?: string
    }
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
  /** Secondary controls beside Filters, e.g. a view switch or a "More" menu. */
  action?: ReactNode
  /** The page's one main button; on a phone it gets a full-width row. */
  primaryAction?: ReactNode
}

export function TableToolbar<TQuery extends Record<string, unknown>>({
  label,
  query,
  setQuery,
  clearFilters,
  searchKey = 'search',
  filters = [],
  action,
  primaryAction,
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

        {/* On a phone the buttons take the row's full width at one 44 px height, like a native toolbar. */}
        <Group gap="sm" wrap="wrap" w={{ base: '100%', sm: 'auto' }}>
          {filters.length > 0 ? (
            <Button
              variant="default"
              mih={{ base: 44, sm: 0 }}
              flex="none"
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
          {primaryAction ? <Box className={classes.primary}>{primaryAction}</Box> : null}
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

'use client'

import { Group, MultiSelect, Select, Stack, Switch, Text, TextInput } from '@mantine/core'
import { arrayOf, stringOf } from '@/lib/table-filters'
import type { FilterControl } from './table-toolbar'

export function FilterField<TQuery extends Record<string, unknown>>({
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
              placeholder="mm/dd/yyyy"
              value={stringOf(query[filter.fromKey])}
              onChange={(event) => patch({ [filter.fromKey]: event.currentTarget.value })}
            />
            <TextInput
              type="date"
              aria-label={`${filter.label}, to`}
              placeholder="mm/dd/yyyy"
              value={stringOf(query[filter.toKey])}
              onChange={(event) => patch({ [filter.toKey]: event.currentTarget.value })}
            />
          </Group>
        </Stack>
      )
  }
}

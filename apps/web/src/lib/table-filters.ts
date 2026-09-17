import type { FilterControl, FilterOption } from '@/components/table-toolbar'

export interface FilterChip {
  id: string
  label: string
  clear: () => void
}

export function stringOf(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function arrayOf(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function labelOf(options: readonly FilterOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

// One chip per applied value, so removing a single choice never means reopening the drawer.
export function chipsOf<TQuery extends Record<string, unknown>>(
  filters: readonly FilterControl[],
  query: TQuery,
  setQuery: (patch: Partial<TQuery>) => void,
): FilterChip[] {
  const chips: FilterChip[] = []
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

'use client'

import { Loader, Select, type SelectProps } from '@mantine/core'
import { useLookup } from '@/features/lookups/use-lookup'
import type { LookupKind } from '@/features/lookups/schema'

export interface LookupSelectProps extends Omit<SelectProps, 'data' | 'value' | 'onChange'> {
  kind: LookupKind
  value: string | null
  onChange: (value: string | null) => void
}

/**
 * A Select whose values live in the database and are fetched the first time someone reaches
 * for it, never on page render.
 *
 * The currently selected value is seeded into `data` so an edit form shows the saved answer
 * before anything is fetched, and keeps showing it even if the option has since been retired.
 */
export function LookupSelect({ kind, value, onChange, ...props }: LookupSelectProps) {
  const lookup = useLookup(kind)

  const values = lookup.options.map((option) => option.value)
  const data = value && !values.includes(value) ? [value, ...values] : values

  return (
    <Select
      {...props}
      data={data}
      value={value}
      onChange={onChange}
      onMouseEnter={lookup.warm}
      onFocus={lookup.warm}
      onDropdownOpen={lookup.open}
      rightSection={lookup.isPending ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={
        lookup.isPending
          ? 'Loading…'
          : lookup.isError
            ? 'None loaded'
            : 'Nothing to choose from yet'
      }
      // The reason is said once, on the field itself, where it is announced and associated.
      error={props.error ?? (lookup.isError ? lookup.error?.message : undefined)}
    />
  )
}

'use client'

import { Select, type SelectProps } from '@mantine/core'
import type { HolidayCountryOption } from '../schema'

export interface CountrySelectProps extends Omit<SelectProps, 'data' | 'value' | 'onChange'> {
  countries: readonly HolidayCountryOption[]
  value: string
  onChange: (code: string) => void
  /** The label for the empty value, which means no country at all. */
  noneLabel?: string
}

export function CountrySelect({
  countries,
  value,
  onChange,
  noneLabel,
  ...props
}: CountrySelectProps) {
  const data = [
    ...(noneLabel ? [{ value: '', label: noneLabel }] : []),
    ...countries.map((country) => ({ value: country.code, label: country.name })),
  ]

  return (
    <Select
      {...props}
      searchable
      allowDeselect={false}
      nothingFoundMessage="No country by that name"
      data={data}
      value={value}
      onChange={(next) => onChange(next ?? '')}
    />
  )
}

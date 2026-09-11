'use client'

import { TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'

export interface SearchFieldProps {
  /** What is being searched, e.g. "clients" — it names the field. */
  label: string
  initial: string
  onSearch: (value: string) => void
  /** Show the label above the box instead of only naming it for a screen reader. */
  labelVisible?: boolean
  placeholder?: string
  width?: number
}

export function SearchField({
  label,
  initial,
  onSearch,
  labelVisible,
  placeholder,
  width = 280,
}: SearchFieldProps) {
  // A search box is a form field like any other, so react-hook-form owns it rather than
  // useState; the debounced write to the URL hangs off the same change event.
  const { register } = useForm<{ search: string }>({ defaultValues: { search: initial } })
  const field = register('search')
  const commit = useDebouncedCallback(onSearch, 300)
  const name = `Search ${label}`

  return (
    <TextInput
      {...field}
      onChange={(event) => {
        void field.onChange(event)
        commit(event.currentTarget.value)
      }}
      type="search"
      label={labelVisible ? name : undefined}
      aria-label={labelVisible ? undefined : name}
      placeholder={placeholder ?? name}
      leftSection={<IconSearch size={16} aria-hidden />}
      w={{ base: '100%', sm: width }}
    />
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import {
  importHolidaysSchema,
  type HolidayCountryOption,
  type ImportHolidaysValues,
} from '../schema'
import { CountrySelect } from './country-select'

export interface ImportHolidaysFormProps {
  year: number
  countries: readonly HolidayCountryOption[]
  /** The country the calendar already follows, so the common case is one click. */
  suggested: string
  onImport: (values: ImportHolidaysValues) => Promise<unknown>
}

export function ImportHolidaysForm({
  year,
  countries,
  suggested,
  onImport,
}: ImportHolidaysFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ImportHolidaysValues>({
    resolver: zodResolver(importHolidaysSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: { year, country: suggested },
  })

  async function submit(values: ImportHolidaysValues) {
    try {
      await onImport(values)
    } catch {
      // The hook already announced the reason; the form stays as it was for a retry.
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate aria-label="Fill in public holidays">
      <Group align="flex-end" gap="sm" wrap="wrap">
        <Controller
          control={control}
          name="country"
          render={({ field }) => (
            <CountrySelect
              label="Public holidays"
              placeholder="Choose a country"
              countries={countries}
              required
              aria-required="true"
              w={260}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.country?.message}
              errorProps={{ role: 'alert' }}
            />
          )}
        />
        <Button type="submit" variant="light" loading={isSubmitting}>
          {isSubmitting ? 'Filling in…' : `Fill in ${year}`}
        </Button>
      </Group>
    </form>
  )
}

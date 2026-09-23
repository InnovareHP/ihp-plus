'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { holidaySchema, type HolidayCountryOption, type HolidayValues } from '../schema'
import { CountrySelect } from './country-select'

export interface AddHolidayFormProps {
  /** The year on screen, so the picker opens inside it. */
  year: number
  countries: readonly HolidayCountryOption[]
  onAdd: (values: HolidayValues) => Promise<void>
}

export function AddHolidayForm({ year, countries, onAdd }: AddHolidayFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HolidayValues>({
    resolver: zodResolver(holidaySchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { date: '', name: '', country: '' },
  })

  async function submit(values: HolidayValues) {
    try {
      await onAdd(values)
      reset()
    } catch (error) {
      // A clash is about the date, so the reason sits under that field.
      setError('date', {
        message: error instanceof Error ? error.message : 'Could not add that holiday.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate aria-label="Add a holiday">
      <Group align="flex-start" gap="sm" wrap="wrap">
        <TextInput
          {...register('date')}
          type="date"
          label="Date"
          required
          min={`${year}-01-01`}
          max={`${year}-12-31`}
          error={errors.date?.message}
        />
        <TextInput
          {...register('name')}
          label="Holiday"
          placeholder="New Year's Day"
          required
          autoComplete="off"
          flex={1}
          miw={200}
          error={errors.name?.message}
        />
        <Controller
          control={control}
          name="country"
          render={({ field }) => (
            <CountrySelect
              label="Who gets it off"
              noneLabel="Everyone"
              countries={countries}
              w={220}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.country?.message}
            />
          )}
        />
      </Group>
      <Group justify="flex-end" mt="sm">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add holiday'}
        </Button>
      </Group>
    </form>
  )
}

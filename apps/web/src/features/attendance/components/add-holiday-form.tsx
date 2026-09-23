'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { holidaySchema, type HolidayValues } from '../schema'

export interface AddHolidayFormProps {
  /** The year on screen, so the picker opens inside it. */
  year: number
  onAdd: (values: HolidayValues) => Promise<void>
}

export function AddHolidayForm({ year, onAdd }: AddHolidayFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HolidayValues>({
    resolver: zodResolver(holidaySchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { date: '', name: '' },
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
      </Group>
      <Group justify="flex-end" mt="sm">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add holiday'}
        </Button>
      </Group>
    </form>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Select, Skeleton, Stack, Text } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useShifts } from '../hooks/use-attendance-admin'
import { useAttendanceSettings, useSaveAttendanceSettings } from '../hooks/use-time-clock'
import {
  attendanceSettingsSchema,
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettingsRow,
} from '../schema'
import { minutesToClock } from '../utils/clock'

// Every zone the platform knows, so a company counts its day the way it actually works.
const TIME_ZONES = Intl.supportedValuesOf('timeZone')

const BUILT_IN_HOURS = ''

/**
 * What is left of company-wide settings: which midnight ends a day, and which shift somebody
 * works until they are given one of their own. The clock's rules live on the shifts themselves.
 */
export function AttendanceSettingsForm() {
  const settings = useAttendanceSettings()
  const shifts = useShifts()
  const save = useSaveAttendanceSettings()

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AttendanceSettingsRow>({
    resolver: zodResolver(attendanceSettingsSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    // A default per field from the first render: neither control has an undefined state.
    defaultValues: DEFAULT_ATTENDANCE_SETTINGS,
    values: settings.data?.settings,
  })

  if (settings.isPending) return <Skeleton height={180} radius="md" aria-busy="true" />
  if (!settings.data?.canManage) return null

  const options = [
    { value: BUILT_IN_HOURS, label: 'Built-in hours (09:00–18:00, Mon–Fri)' },
    ...(shifts.data?.shifts ?? []).map((shift) => ({
      value: shift.id,
      label: `${shift.name} · ${minutesToClock(shift.shiftStartMinutes)}–${minutesToClock(shift.shiftEndMinutes)}`,
    })),
  ]

  async function submit(values: AttendanceSettingsRow) {
    try {
      await save.mutateAsync(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save these settings.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not save the attendance settings" />

        <Text size="sm" c="dimmed">
          Selfies, notes, grace and the auto-close belong to a shift — write them on the shift
          itself. These two are true of the whole company.
        </Text>

        <Group grow align="flex-start">
          <Controller
            control={control}
            name="timeZone"
            render={({ field }) => (
              <Select
                label="Working day counted in"
                description="Which midnight ends a day for everyone here."
                searchable
                data={TIME_ZONES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? field.value)}
                onBlur={field.onBlur}
                error={errors.timeZone?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />

          <Controller
            control={control}
            name="defaultShiftId"
            render={({ field }) => (
              <Select
                label="Company hours"
                description="Worked by anybody without a shift of their own."
                data={options}
                value={field.value}
                allowDeselect={false}
                onChange={(value) => field.onChange(value ?? BUILT_IN_HOURS)}
                onBlur={field.onBlur}
                error={errors.defaultShiftId?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />
        </Group>

        <Group justify="flex-end">
          <Button type="submit" loading={isSubmitting || save.isPending} disabled={!isDirty}>
            {isSubmitting || save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

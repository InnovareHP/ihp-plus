'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Group,
  NumberInput,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useAttendanceSettings, useSaveAttendanceSettings } from '../hooks/use-time-clock'
import {
  attendanceSettingsSchema,
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettingsRow,
} from '../schema'
import { clockToMinutes, minutesToClock } from '../utils/clock'
import { WorkdaysField } from './workdays-field'

// Every zone the platform knows, so a company counts its day the way it actually works.
const TIME_ZONES = Intl.supportedValuesOf('timeZone')

/** Only an admin sees this; a member's half of attendance is the clock on their own screen. */
export function AttendanceSettingsForm() {
  const settings = useAttendanceSettings()
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
    // A default per field from the first render: the switches and the day picker have no undefined state.
    defaultValues: DEFAULT_ATTENDANCE_SETTINGS,
    values: settings.data?.settings,
  })

  if (settings.isPending) return <Skeleton height={320} radius="md" aria-busy="true" />
  if (!settings.data?.canManage) return null

  async function submit(values: AttendanceSettingsRow) {
    try {
      await save.mutateAsync(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save these rules.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not save the attendance rules" />

        <Text size="sm" c="dimmed">
          These apply to everyone in the company. Members clock in and out on the Time clock page;
          only an admin records or corrects a day, including their own.
        </Text>

        <Controller
          control={control}
          name="requireSelfie"
          render={({ field }) => (
            <Switch
              label="A selfie is required at the clock"
              description="A photo is taken at clock in and clock out, and kept with that day."
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          control={control}
          name="captureLocation"
          render={({ field }) => (
            <Switch
              label="Record where the clock was pressed"
              description="Coordinates are stored with the punch; a refused fix never blocks it."
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          control={control}
          name="requireNote"
          render={({ field }) => (
            <Switch
              label="A note is required at clock out"
              description="Asked for before the day is closed."
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />

        <Group grow align="flex-start">
          <Controller
            control={control}
            name="shiftStartMinutes"
            render={({ field }) => (
              <TextInput
                type="time"
                label="Company shift starts"
                value={minutesToClock(field.value)}
                onChange={(event) =>
                  field.onChange(clockToMinutes(event.currentTarget.value) ?? field.value)
                }
                onBlur={field.onBlur}
                error={errors.shiftStartMinutes?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />
          <Controller
            control={control}
            name="shiftEndMinutes"
            render={({ field }) => (
              <TextInput
                type="time"
                label="and ends"
                value={minutesToClock(field.value)}
                onChange={(event) =>
                  field.onChange(clockToMinutes(event.currentTarget.value) ?? field.value)
                }
                onBlur={field.onBlur}
                error={errors.shiftEndMinutes?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />
        </Group>

        <Controller
          control={control}
          name="workdays"
          render={({ field }) => (
            <WorkdaysField
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.workdays?.message}
            />
          )}
        />

        <Group grow align="flex-start">
          <Controller
            control={control}
            name="graceMinutes"
            render={({ field }) => (
              <NumberInput
                label="Grace before late"
                description="Minutes after the shift start."
                suffix=" min"
                min={0}
                max={120}
                clampBehavior="strict"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === 'number' ? value : 0)}
                onBlur={field.onBlur}
                error={errors.graceMinutes?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />
          <Controller
            control={control}
            name="autoClockOutHours"
            render={({ field }) => (
              <NumberInput
                label="Close a forgotten day after"
                description="Hours. 0 never closes one on its own."
                suffix=" hours"
                min={0}
                max={24}
                clampBehavior="strict"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === 'number' ? value : 0)}
                onBlur={field.onBlur}
                error={errors.autoClockOutHours?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />
        </Group>

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
              w={320}
            />
          )}
        />

        <Group justify="flex-end">
          <Button type="submit" loading={isSubmitting || save.isPending} disabled={!isDirty}>
            {isSubmitting || save.isPending ? 'Saving…' : 'Save rules'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

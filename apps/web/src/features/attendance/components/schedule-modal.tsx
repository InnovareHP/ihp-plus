'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, NumberInput, Stack, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useSaveSchedule } from '../hooks/use-attendance-admin'
import { scheduleSchema, type AttendanceScheduleRow, type ScheduleValues } from '../schema'
import { clockToMinutes, minutesToClock } from '../utils/clock'
import { WorkdaysField } from './workdays-field'

export interface ScheduleModalProps {
  opened: boolean
  onClose: () => void
  schedule: AttendanceScheduleRow
}

/** One person's shift: when it starts, when it ends, how much grace, which days. */
export function ScheduleModal({ opened, onClose, schedule }: ScheduleModalProps) {
  const save = useSaveSchedule()

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: {
      userId: schedule.userId,
      shiftStartMinutes: schedule.shiftStartMinutes,
      shiftEndMinutes: schedule.shiftEndMinutes,
      graceMinutes: schedule.graceMinutes,
      workdays: schedule.workdays,
    },
  })

  async function submit(values: ScheduleValues) {
    try {
      await save.mutateAsync(values)
      onClose()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save that shift.',
      })
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Shift for ${schedule.userName}`} centered>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not save that shift" />

          <Group grow align="flex-start">
            <Controller
              control={control}
              name="shiftStartMinutes"
              render={({ field }) => (
                <TextInput
                  type="time"
                  label="Starts"
                  required
                  aria-required="true"
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
                  label="Ends"
                  required
                  aria-required="true"
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
            name="graceMinutes"
            render={({ field }) => (
              <NumberInput
                label="Grace"
                description="Minutes after the start before an arrival counts as late."
                suffix=" min"
                min={0}
                max={120}
                clampBehavior="strict"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === 'number' ? value : 0)}
                onBlur={field.onBlur}
                error={errors.graceMinutes?.message}
                errorProps={{ role: 'alert' }}
                w={200}
              />
            )}
          />

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

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || save.isPending}>
              {isSubmitting || save.isPending ? 'Saving…' : 'Save shift'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

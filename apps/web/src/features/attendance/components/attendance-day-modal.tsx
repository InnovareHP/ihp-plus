'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, NumberInput, Stack, Textarea, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useSaveAttendanceDay } from '../hooks/use-attendance-admin'
import { attendanceDaySchema, type AttendanceDayRow, type AttendanceDayValues } from '../schema'
import { formatTimeOfDay } from '@ihp/clock'

export interface AttendanceDayModalProps {
  opened: boolean
  onClose: () => void
  /** Whose day it is; the person is fixed once the modal is open. */
  person: { userId: string; userName: string }
  workDate: string
  timeZone: string
  day?: AttendanceDayRow
}

/** An admin correcting a day: a forgotten clock out, a late start, a break nobody logged. */
export function AttendanceDayModal({
  opened,
  onClose,
  person,
  workDate,
  timeZone,
  day,
}: AttendanceDayModalProps) {
  const save = useSaveAttendanceDay()

  const {
    control,
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceDayValues>({
    resolver: zodResolver(attendanceDaySchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: {
      dayId: day?.id,
      userId: person.userId,
      workDate: day?.workDate ?? workDate,
      clockInTime: day?.clockInAt ? formatTimeOfDay(day.clockInAt, timeZone) : '09:00',
      clockOutTime: day?.clockOutAt ? formatTimeOfDay(day.clockOutAt, timeZone) : '',
      breakMinutes: Math.round((day?.breakSeconds ?? 0) / 60),
      note: day?.note ?? '',
    },
  })

  async function submit(values: AttendanceDayValues) {
    try {
      await save.mutateAsync(values)
      onClose()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save that day.',
      })
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${day ? 'Correct' : 'Add'} a day for ${person.userName}`}
      centered
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not save that day" />

          <TextInput
            type="date"
            label="Day"
            required
            aria-required="true"
            error={errors.workDate?.message}
            errorProps={{ role: 'alert' }}
            {...register('workDate')}
          />

          <Group grow align="flex-start">
            <TextInput
              type="time"
              label="Clocked in"
              description="When the shift started."
              required
              aria-required="true"
              error={errors.clockInTime?.message}
              errorProps={{ role: 'alert' }}
              {...register('clockInTime')}
            />
            <TextInput
              type="time"
              label="Clocked out"
              description="Empty leaves it running."
              error={errors.clockOutTime?.message}
              errorProps={{ role: 'alert' }}
              {...register('clockOutTime')}
            />
          </Group>

          <Controller
            control={control}
            name="breakMinutes"
            render={({ field }) => (
              <NumberInput
                label="Break time"
                description="Minutes taken out of the shift."
                suffix=" min"
                min={0}
                max={12 * 60}
                clampBehavior="strict"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === 'number' ? value : 0)}
                onBlur={field.onBlur}
                error={errors.breakMinutes?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />

          <Textarea
            label="Note"
            description="Why the day was corrected, for whoever reads it next."
            autosize
            minRows={2}
            error={errors.note?.message}
            errorProps={{ role: 'alert' }}
            {...register('note')}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || save.isPending}>
              {isSubmitting || save.isPending ? 'Saving…' : 'Save day'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

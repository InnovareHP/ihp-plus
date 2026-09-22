'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Divider, Group, Modal, NumberInput, Stack, Switch, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useSaveShift } from '../hooks/use-attendance-admin'
import { shiftSchema, type AttendanceShiftRow, type ShiftValues } from '../schema'
import { clockToMinutes, DEFAULT_WORKDAYS, minutesToClock } from '../utils/clock'
import { WorkdaysField } from './workdays-field'

export interface ShiftModalProps {
  opened: boolean
  onClose: () => void
  /** Absent writes a new shift; present edits that one. */
  shift?: AttendanceShiftRow
  /** The company hours a new shift starts from. */
  defaults: AttendanceShiftRow
}

/** A shift is written once here and handed out under the organization. */
export function ShiftModal({ opened, onClose, shift, defaults }: ShiftModalProps) {
  const save = useSaveShift()

  const {
    control,
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShiftValues>({
    resolver: zodResolver(shiftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: {
      shiftId: shift?.id,
      name: shift?.name ?? '',
      shiftStartMinutes: shift?.shiftStartMinutes ?? defaults.shiftStartMinutes,
      shiftEndMinutes: shift?.shiftEndMinutes ?? defaults.shiftEndMinutes,
      graceMinutes: shift?.graceMinutes ?? defaults.graceMinutes,
      workdays: shift?.workdays ?? DEFAULT_WORKDAYS,
      requireSelfie: shift?.requireSelfie ?? defaults.requireSelfie,
      requireNote: shift?.requireNote ?? defaults.requireNote,
      captureLocation: shift?.captureLocation ?? defaults.captureLocation,
      autoClockOutHours: shift?.autoClockOutHours ?? defaults.autoClockOutHours,
    },
  })

  async function submit(values: ShiftValues) {
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={shift ? `Edit ${shift.name}` : 'New shift'}
      centered
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not save that shift" />

          <TextInput
            label="Name"
            description="What people call it — Morning, Mid, Graveyard."
            placeholder="Morning"
            required
            aria-required="true"
            error={errors.name?.message}
            errorProps={{ role: 'alert' }}
            {...register('name')}
          />

          <Group grow align="flex-start">
            <Controller
              control={control}
              name="shiftStartMinutes"
              render={({ field }) => (
                <TextInput
                  type="time"
                  label="Starts"
                  description="When the shift begins."
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
                  description="Earlier means past midnight."
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

          {/* The rules belong to the shift: a night shift can ask for a selfie, the office one not. */}
          <Divider label="What the clock asks for" labelPosition="left" />

          <Controller
            control={control}
            name="requireSelfie"
            render={({ field }) => (
              <Switch
                label="A selfie at each end"
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
                label="Where the clock was pressed"
                description="Coordinates ride along with the punch; a refused fix never blocks it."
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
                label="A note at clock out"
                description="Asked for before the day is closed."
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
                onBlur={field.onBlur}
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
                w={220}
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

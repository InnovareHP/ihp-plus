'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useSaveShift } from '../hooks/use-attendance-admin'
import { useHolidayCountries } from '../hooks/use-holidays'
import { useSaveAttendanceSettings } from '../hooks/use-time-clock'
import {
  shiftFormSchema,
  type AttendanceSettingsRow,
  type AttendanceShiftRow,
  type ShiftFormValues,
} from '../schema'
import { clockToMinutes, DEFAULT_WORKDAYS, minutesToClock } from '@ihp/clock'
import { CountrySelect } from './country-select'
import { ShiftHolidays } from './shift-holidays'
import { WorkdaysField } from './workdays-field'

export interface ShiftModalProps {
  opened: boolean
  onClose: () => void
  /** Absent writes a new shift; present edits that one. */
  shift?: AttendanceShiftRow
  /** The company hours a new shift starts from. */
  defaults: AttendanceShiftRow
  /** The company-wide time zone and default shift, edited here alongside the shift. */
  settings: AttendanceSettingsRow
}

// Every zone the platform knows, so a company counts its day the way it actually works.
const TIME_ZONES = Intl.supportedValuesOf('timeZone')

/** A shift is written once here and handed out under the organization. */
export function ShiftModal({ opened, onClose, shift, defaults, settings }: ShiftModalProps) {
  const save = useSaveShift()
  const saveSettings = useSaveAttendanceSettings()
  const countries = useHolidayCountries()

  const {
    control,
    handleSubmit,
    register,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
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
      sendReminders: shift?.sendReminders ?? defaults.sendReminders,
      holidayCountry: shift?.holidayCountry ?? defaults.holidayCountry,
      autoClockOutHours: shift?.autoClockOutHours ?? defaults.autoClockOutHours,
      timeZone: settings.timeZone,
      isCompanyHours: shift?.isDefault ?? false,
    },
  })
  const pendingCountry = useWatch({ control, name: 'holidayCountry' })
  const pendingCountryName =
    countries.data?.find((one) => one.code === pendingCountry)?.name ?? pendingCountry

  async function submit(values: ShiftFormValues) {
    const { timeZone, isCompanyHours, ...shiftValues } = values

    let saved: AttendanceShiftRow
    try {
      saved = await save.mutateAsync(shiftValues)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save that shift.',
      })
      return
    }

    // Turning the switch off on the current company hours hands them back to the built-in ones.
    const defaultShiftId = isCompanyHours
      ? saved.id
      : settings.defaultShiftId === saved.id
        ? ''
        : settings.defaultShiftId

    if (timeZone !== settings.timeZone || defaultShiftId !== settings.defaultShiftId) {
      try {
        await saveSettings.mutateAsync({ timeZone, defaultShiftId })
      } catch (error) {
        // The shift exists now, so a retry must update it rather than write a second one.
        setValue('shiftId', saved.id)
        setError('root', {
          message: `The shift was saved, but the company settings were not — ${
            error instanceof Error ? error.message : 'try again.'
          }`,
        })
        return
      }
    }

    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={shift ? `Edit ${shift.name}` : 'New shift'}
      size="lg"
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

          <Controller
            control={control}
            name="holidayCountry"
            render={({ field }) => (
              <CountrySelect
                label="Public holidays"
                description="Whose public holidays this shift gets off. They are filled in for this year and next, then every December."
                noneLabel="None — company days off only"
                countries={countries.data ?? []}
                disabled={countries.isPending}
                placeholder={countries.isError ? 'Could not load countries' : undefined}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.holidayCountry?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />

          <Divider label="The whole company" labelPosition="left" />

          <Controller
            control={control}
            name="timeZone"
            render={({ field }) => (
              <Select
                label="Company time zone"
                description="Shared by every shift: the midnight that ends a working day for everyone."
                searchable
                allowDeselect={false}
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
            name="isCompanyHours"
            render={({ field }) => (
              <Switch
                label="Make this the company hours"
                description="Anyone without a shift of their own works this one. With none chosen, the built-in 09:00–18:00, Mon–Fri apply."
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
                onBlur={field.onBlur}
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
            name="sendReminders"
            render={({ field }) => (
              <Switch
                label="Email reminders"
                description="Emails anyone not clocked in after the grace period, or still clocked in 30 minutes after the shift ends."
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
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save shift'}
            </Button>
          </Group>
        </Stack>
      </form>

      {/* Outside the shift's form: a day off is saved on its own, and forms cannot nest. */}
      <Stack gap="sm" mt="xl" component="section" aria-labelledby="shift-days-off-heading">
        <Divider />
        <Text fw={600} size="sm" id="shift-days-off-heading">
          Days off on this shift
        </Text>
        {shift && pendingCountry === shift.holidayCountry ? (
          <ShiftHolidays country={shift.holidayCountry} countries={countries.data ?? []} />
        ) : (
          <Text size="sm" c="dimmed">
            {pendingCountry
              ? `Save the shift to fill in the public holidays for ${pendingCountryName}, this year and next.`
              : 'Save the shift to see and add its days off.'}
          </Text>
        )}
      </Stack>
    </Modal>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, NumberInput, Skeleton, Stack, Switch, Text } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { useSaveTimeSettings, useTimeSettings } from '../hooks/use-time'
import { timeSettingsSchema, type TaskTimeSettingsRow } from '../schema'

/** Only an admin sees this; a member's half of time tracking is the timer on the task itself. */
export function TimeSettingsForm() {
  const settings = useTimeSettings()
  const save = useSaveTimeSettings()

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TaskTimeSettingsRow>({
    resolver: zodResolver(timeSettingsSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: settings.data?.settings,
  })

  if (settings.isPending) return <Skeleton height={220} radius="md" aria-busy="true" />
  if (!settings.data?.canManage) return null

  async function submit(values: TaskTimeSettingsRow) {
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
        <FormError message={errors.root?.message} title="Could not save the clock rules" />

        <Text size="sm" c="dimmed">
          These apply to everyone in the company. Members clock in and out on the task itself.
        </Text>

        <Controller
          control={control}
          name="allowManualEntry"
          render={({ field }) => (
            <Switch
              label="Members can log time by hand"
              description="Off means the timer is the only way hours are recorded."
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          control={control}
          name="allowSelfEdit"
          render={({ field }) => (
            <Switch
              label="Members can delete their own entries"
              description="Off means an entry stands once it is recorded, and only an admin removes it."
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
              label="A note is required on every entry"
              description="Asked for when the timer stops, and when time is written up afterwards."
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          control={control}
          name="trackOnlyAssigned"
          render={({ field }) => (
            <Switch
              label="Time only on assigned work"
              description="Members can track only against tasks they are assigned to."
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          control={control}
          name="autoStopHours"
          render={({ field }) => (
            <NumberInput
              label="Stop a forgotten timer after"
              description="Hours. A timer left running is closed at this length; 0 never closes one."
              suffix=" hours"
              min={0}
              max={24}
              clampBehavior="strict"
              value={field.value}
              onChange={(value) => field.onChange(typeof value === 'number' ? value : 0)}
              onBlur={field.onBlur}
              error={errors.autoStopHours?.message}
              errorProps={{ role: 'alert' }}
              w={220}
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

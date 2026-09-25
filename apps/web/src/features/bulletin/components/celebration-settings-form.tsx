'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stack, Switch, Text } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { bulletinSettingsSchema, type BulletinSettingsRow } from '../schema'

export interface CelebrationSettingsFormProps {
  settings: BulletinSettingsRow
  onSave: (values: BulletinSettingsRow) => Promise<void>
  onCancel: () => void
}

const SWITCHES = [
  {
    name: 'celebrateBirthdays',
    label: 'Birthdays',
    description: 'A birthday wish on the day. The year of birth is never shown.',
  },
  {
    name: 'celebrateAnniversaries',
    label: 'Work anniversaries',
    description: 'Marks each full year since the start date on someone’s profile.',
  },
  {
    name: 'welcomeNewHires',
    label: 'New hires',
    description: 'A welcome post once someone finishes onboarding.',
  },
] as const satisfies readonly {
  name: keyof BulletinSettingsRow
  label: string
  description: string
}[]

export function CelebrationSettingsForm({
  settings,
  onSave,
  onCancel,
}: CelebrationSettingsFormProps) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BulletinSettingsRow>({
    resolver: zodResolver(bulletinSettingsSchema),
    defaultValues: settings,
  })

  async function submit(values: BulletinSettingsRow) {
    try {
      await onSave(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save — try again.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not save automatic posts" />
        <Text size="sm" c="dimmed">
          The portal posts these to the board each morning, in the company’s time zone.
        </Text>
        {SWITCHES.map((one) => (
          <Controller
            key={one.name}
            control={control}
            name={one.name}
            render={({ field }) => (
              <Switch
                label={one.label}
                description={one.description}
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
                onBlur={field.onBlur}
              />
            )}
          />
        ))}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Fieldset,
  Group,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { settingsSchema, type SettingsValues } from '../schema'

export interface DigestSettingsFormProps {
  settings: SettingsValues
  clientContacts: number
  canManage: boolean
  onSave: (values: SettingsValues) => Promise<unknown>
}

/** Who gets the weekly email; client contacts stay off until IT deliberately turns them on. */
export function DigestSettingsForm({
  settings,
  clientContacts,
  canManage,
  onSave,
}: DigestSettingsFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty, isSubmitSuccessful },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  })

  async function onSubmit(values: SettingsValues) {
    try {
      await onSave(values)
      reset(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the settings.',
      })
    }
  }

  const recipientError = Array.isArray(errors.recipients)
    ? errors.recipients.find(Boolean)?.message
    : errors.recipients?.message

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Security email settings">
      <Fieldset variant="unstyled" disabled={!canManage}>
        <Stack gap="md">
          {errors.root ? (
            <Alert role="alert" color="red" variant="light" title="Could not save the settings">
              {errors.root.message}
            </Alert>
          ) : null}
          <Controller
            control={control}
            name="enabled"
            render={({ field }) => (
              <Switch
                label="Send weekly security emails"
                description="A draft is written every Thursday for the next Monday, and goes out only once it is approved."
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="recipients"
            render={({ field }) => (
              <TagsInput
                label="Recipients"
                description="Press Enter after each address."
                placeholder="name@company.com"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                splitChars={[',', ' ', ';']}
                clearable
                error={recipientError}
                errorProps={{ role: 'alert' }}
                inputMode="email"
              />
            )}
          />
          <Controller
            control={control}
            name="includeClients"
            render={({ field }) => (
              <Switch
                label="Also send to client contacts"
                description={`Adds the email on every active client — ${clientContacts} right now.`}
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
                onBlur={field.onBlur}
              />
            )}
          />
          <TextInput
            label="Report concerns to"
            description="Named at the end of every email as who to tell about something suspicious."
            placeholder="it@company.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            error={errors.reportTo?.message}
            errorProps={{ role: 'alert' }}
            {...register('reportTo')}
          />
          {canManage ? (
            <Group justify="flex-end">
              <Button type="submit" loading={isSubmitting}>
                Save settings
              </Button>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              Only the IT lead or an admin can change these.
            </Text>
          )}
          {isSubmitSuccessful && !isDirty ? (
            <Text size="sm" c="dimmed" role="status">
              Saved.
            </Text>
          ) : null}
        </Stack>
      </Fieldset>
    </form>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, Switch, Text, Textarea } from '@mantine/core'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  rejectSchema,
  type ApplicationSummary,
  type RejectInput,
  type RejectValues,
} from '../schema'

export interface RejectApplicationModalProps {
  application: ApplicationSummary
  /** The organization's standard wording, from hiring settings. */
  defaultMessage: string
  onClose: () => void
  onConfirm: (values: RejectValues) => void
}

export function RejectApplicationModal({
  application,
  defaultMessage,
  onClose,
  onConfirm,
}: RejectApplicationModalProps) {
  const firstName = application.fullName.split(/\s+/)[0] ?? application.fullName
  const { control, register, handleSubmit, formState } = useForm<
    RejectInput,
    unknown,
    RejectValues
  >({
    resolver: zodResolver(rejectSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      applicationId: application.id,
      reason: '',
      sendEmail: true,
      message: defaultMessage,
    },
  })
  const sendEmail = useWatch({ control, name: 'sendEmail' }) ?? true

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Not moving forward with ${application.fullName}?`}
      centered
    >
      <form onSubmit={handleSubmit(onConfirm)} noValidate>
        <Stack gap="md">
          <Textarea
            {...register('reason')}
            label="Why, for the team"
            description="Only HR and admins see this. It helps when the same role opens again."
            autosize
            minRows={2}
            error={formState.errors.reason?.message}
            errorProps={{ role: 'alert' }}
          />
          <Controller
            control={control}
            name="sendEmail"
            render={({ field }) => (
              <Switch
                label={`Email ${firstName}`}
                checked={field.value ?? true}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {sendEmail ? (
            <Textarea
              {...register('message')}
              label="Message"
              description={`Sent to ${application.email} after the undo window closes.`}
              autosize
              minRows={4}
              error={formState.errors.message?.message}
              errorProps={{ role: 'alert' }}
            />
          ) : (
            <Text size="sm" c="dimmed">
              They are not told; their status link will read that the application is closed.
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Keep in the running
            </Button>
            <Button type="submit" color="red">
              Not moving forward
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

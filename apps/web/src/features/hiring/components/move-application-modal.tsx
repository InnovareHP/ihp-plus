'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, Switch, Text, Textarea } from '@mantine/core'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  moveSchema,
  type ApplicationSummary,
  type MoveInput,
  type MoveValues,
  type Stage,
} from '../schema'

export interface MoveApplicationModalProps {
  application: ApplicationSummary
  stage: Stage
  onClose: () => void
  onConfirm: (values: MoveValues) => void
}

// Only a stage with a message opens this: the one move that reaches the applicant gets a look first.
export function MoveApplicationModal({
  application,
  stage,
  onClose,
  onConfirm,
}: MoveApplicationModalProps) {
  const firstName = application.fullName.split(/\s+/)[0] ?? application.fullName
  const { control, register, handleSubmit, formState } = useForm<MoveInput, unknown, MoveValues>({
    resolver: zodResolver(moveSchema),
    mode: 'onTouched',
    defaultValues: {
      applicationId: application.id,
      stageId: stage.id,
      sendEmail: true,
      message: stage.message,
    },
  })
  const sendEmail = useWatch({ control, name: 'sendEmail' }) ?? true

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Move ${application.fullName} to ${stage.name}`}
      centered
    >
      <form onSubmit={handleSubmit(onConfirm)} noValidate>
        <Stack gap="md">
          <Controller
            control={control}
            name="sendEmail"
            render={({ field }) => (
              <Switch
                label={`Email ${firstName} this stage's message`}
                checked={field.value ?? true}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {sendEmail ? (
            <Textarea
              {...register('message')}
              label="Message"
              description={`Sent to ${application.email}. Changes here apply to this email only.`}
              autosize
              minRows={4}
              error={formState.errors.message?.message}
              errorProps={{ role: 'alert' }}
            />
          ) : (
            <Text size="sm" c="dimmed">
              They are moved quietly; nothing is sent.
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {sendEmail ? `Move and email ${firstName}` : `Move to ${stage.name}`}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

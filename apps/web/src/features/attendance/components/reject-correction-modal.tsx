'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { CORRECTION_NEEDS_REASON, type AttendanceCorrectionRow } from '../schema'

const reasonSchema = z.object({ note: z.string().trim().min(1, CORRECTION_NEEDS_REASON).max(300) })
type ReasonValues = z.infer<typeof reasonSchema>

export interface RejectCorrectionModalProps {
  correction: AttendanceCorrectionRow | undefined
  onClose: () => void
  onReject: (correction: AttendanceCorrectionRow, note: string) => void
}

/** Turning a request down needs a reason, so the member knows what to do instead. */
export function RejectCorrectionModal({
  correction,
  onClose,
  onReject,
}: RejectCorrectionModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReasonValues>({
    resolver: zodResolver(reasonSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { note: '' },
  })

  return (
    <Modal
      opened={correction !== undefined}
      onClose={onClose}
      title={correction ? `Turn down ${correction.userName}'s request` : ''}
      closeButtonProps={{ 'aria-label': 'Close turn down the request' }}
      centered
    >
      {correction ? (
        <form
          onSubmit={handleSubmit((values) => {
            onReject(correction, values.note)
            onClose()
          })}
          noValidate
        >
          <Stack gap="md">
            <Textarea
              label="Reason"
              description="They are emailed this."
              required
              aria-required="true"
              autosize
              minRows={3}
              error={errors.note?.message}
              errorProps={{ role: 'alert' }}
              data-autofocus
              {...register('note')}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" color="red" variant="light">
                Turn down request
              </Button>
            </Group>
          </Stack>
        </form>
      ) : null}
    </Modal>
  )
}

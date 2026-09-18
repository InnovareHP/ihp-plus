'use client'

import { Button, Group, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { REJECTION_NEEDS_REASON, type Decision } from '../schema'

export interface DecisionFieldsProps {
  /** Named in the buttons so the control says which request it acts on. */
  label: string
  isPending: boolean
  noteHelp?: string
  onDecide: (decision: Decision, note: string) => void
  onCancel?: () => void
}

/**
 * Approve and reject are two submissions of one note, so the decision travels with the click
 * rather than through state a handler would have to read back before it settles.
 */
export function DecisionFields({
  label,
  isPending,
  noteHelp,
  onDecide,
  onCancel,
}: DecisionFieldsProps) {
  const {
    register,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<{ note: string }>({ defaultValues: { note: '' } })

  function decide(decision: Decision) {
    const note = getValues('note').trim()
    if (decision === 'rejected' && note.length === 0) {
      setError('note', { message: REJECTION_NEEDS_REASON })
      return
    }
    clearErrors('note')
    onDecide(decision, note)
  }

  return (
    <Stack gap="md">
      <Textarea
        {...register('note')}
        label="Note"
        placeholder="Say what decided it"
        description={noteHelp ?? 'Optional when approving, required when rejecting.'}
        autosize
        minRows={3}
        error={errors.note?.message}
        errorProps={{ role: 'alert' }}
        data-autofocus
      />

      <Group>
        <Button type="button" loading={isPending} onClick={() => decide('approved')}>
          Approve {label}
        </Button>
        <Button
          type="button"
          color="red"
          variant="light"
          disabled={isPending}
          onClick={() => decide('rejected')}
        >
          Reject {label}
        </Button>
        {onCancel ? (
          <Button type="button" variant="subtle" color="gray" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </Group>
    </Stack>
  )
}

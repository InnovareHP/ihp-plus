'use client'

import { Button, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import actionRow from '@/components/action-row.module.css'
import { DialogActions } from '@/components/dialog-actions'
import { REJECTION_NEEDS_REASON, type Decision } from '../schema'

export interface DecisionFieldsProps {
  /** Named in the buttons so the control says which request it acts on. */
  label: string
  isPending: boolean
  noteHelp?: string
  onDecide: (decision: Decision, note: string) => void
  onCancel?: () => void
  /** Inside a modal the buttons pin to the bottom of a phone screen instead of sharing a row. */
  inDialog?: boolean
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
  inDialog = false,
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

  const buttons = (
    <>
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
    </>
  )

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

      {inDialog ? (
        <DialogActions>{buttons}</DialogActions>
      ) : (
        <div className={actionRow.row}>{buttons}</div>
      )}
    </Stack>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import { announceSuccess } from '@/lib/announce'
import { useCancelRequest } from '../hooks/use-requests'
import { cancelRequestSchema, type CancelRequestValues, type RequestRow } from '../schema'

/**
 * Takes approved leave back. Not undoable — the days become workdays again and the requester is
 * emailed — so it asks for the reason and names what it does on the button.
 */
export function CancelLeavePanel({ row }: { row: RequestRow }) {
  const cancel = useCancelRequest()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CancelRequestValues>({
    resolver: zodResolver(cancelRequestSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { submissionId: row.id, note: '' },
  })

  async function submit(values: CancelRequestValues) {
    try {
      const updated = await cancel.mutateAsync(values)
      announceSuccess(`${updated.formName} cancelled. ${updated.requesterName} has been emailed.`)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not cancel that leave.',
      })
    }
  }

  return (
    <PageSection
      title="Cancel this leave"
      description={`The days go back to being workdays on ${row.requesterName}'s time clock, and they are emailed your reason.`}
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not cancel the leave" />
          <Textarea
            {...register('note')}
            label="Reason"
            required
            aria-required="true"
            placeholder="Say what changed"
            autosize
            minRows={3}
            error={errors.note?.message}
            errorProps={{ role: 'alert' }}
          />
          <Group>
            <Button type="submit" color="red" variant="light" loading={isSubmitting}>
              {isSubmitting ? 'Cancelling…' : `Cancel ${row.requesterName}'s leave`}
            </Button>
          </Group>
        </Stack>
      </form>
    </PageSection>
  )
}

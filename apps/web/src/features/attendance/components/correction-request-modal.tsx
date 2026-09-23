'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, NumberInput, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
import { useRequestCorrection } from '../hooks/use-corrections'
import { correctionSchema, type CorrectionValues } from '../schema'

export interface CorrectionRequestModalProps {
  opened: boolean
  onClose: () => void
  /** The day as the member remembers it; filled from their row when they start from one. */
  initial: CorrectionValues
  /** The latest date that can be asked about: today, in the company zone. */
  today: string
}

/** A member asking for one of their days to be put right — the admin applies or declines it. */
export function CorrectionRequestModal({
  opened,
  onClose,
  initial,
  today,
}: CorrectionRequestModalProps) {
  const request = useRequestCorrection()
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CorrectionValues>({
    resolver: zodResolver(correctionSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: initial,
  })

  async function submit(values: CorrectionValues) {
    try {
      await request.mutateAsync(values)
      announceSuccess('Correction request sent to your admin.')
      onClose()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not send that request.',
      })
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Ask for a correction"
      closeButtonProps={{ 'aria-label': 'Close ask for a correction' }}
      centered
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not send the request" />
          <Text size="sm" c="dimmed">
            Say how the day really went. An admin checks it, and the day changes only once they
            approve.
          </Text>

          <TextInput
            type="date"
            label="Day"
            required
            aria-required="true"
            max={today}
            error={errors.workDate?.message}
            errorProps={{ role: 'alert' }}
            {...register('workDate')}
          />

          <Group grow align="flex-start">
            <TextInput
              type="time"
              label="Clocked in"
              description="When you started."
              required
              aria-required="true"
              error={errors.clockInTime?.message}
              errorProps={{ role: 'alert' }}
              {...register('clockInTime')}
            />
            <TextInput
              type="time"
              label="Clocked out"
              description="When you left."
              required
              aria-required="true"
              error={errors.clockOutTime?.message}
              errorProps={{ role: 'alert' }}
              {...register('clockOutTime')}
            />
          </Group>

          <Controller
            control={control}
            name="breakMinutes"
            render={({ field }) => (
              <NumberInput
                label="Break time"
                description="Minutes you were off the clock in between."
                suffix=" min"
                min={0}
                max={12 * 60}
                clampBehavior="strict"
                value={field.value}
                onChange={(value) => field.onChange(typeof value === 'number' ? value : 0)}
                onBlur={field.onBlur}
                error={errors.breakMinutes?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />

          <Textarea
            label="What happened"
            description="For example: forgot to clock out, left at 18:00."
            required
            aria-required="true"
            autosize
            minRows={2}
            error={errors.reason?.message}
            errorProps={{ role: 'alert' }}
            {...register('reason')}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send request'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

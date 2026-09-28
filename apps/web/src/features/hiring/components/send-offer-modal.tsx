'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FileInput, Group, Modal, Stack, Textarea } from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
import { useSendOffer } from '../hooks/use-offers'
import {
  DEFAULT_OFFER_MESSAGE,
  OFFER_LETTER_ACCEPT,
  sendOfferFormSchema,
  type ApplicationSummary,
  type SendOfferFormInput,
  type SendOfferFormValues,
} from '../schema'

export interface SendOfferModalProps {
  application: ApplicationSummary
  /** True when the last offer was declined, so this one replaces it. */
  revised: boolean
  /** The previous offer's wording, so a revision starts from what was already said. */
  previousMessage: string | undefined
  onClose: () => void
}

export function SendOfferModal({
  application,
  revised,
  previousMessage,
  onClose,
}: SendOfferModalProps) {
  const send = useSendOffer()
  const firstName = application.fullName.split(/\s+/)[0] ?? application.fullName
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SendOfferFormInput, unknown, SendOfferFormValues>({
    resolver: zodResolver(sendOfferFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      applicationId: application.id,
      message: previousMessage ?? DEFAULT_OFFER_MESSAGE,
      letter: null,
    },
  })

  async function onSubmit(values: SendOfferFormValues) {
    try {
      await send.mutateAsync(values)
      announceSuccess(`The offer is on its way to ${application.fullName}.`)
      onClose()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not send the offer.',
      })
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={revised ? `Send ${firstName} a revised offer` : `Send ${firstName} an offer`}
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not send the offer" />

          <Controller
            control={control}
            name="message"
            render={({ field }) => (
              <Textarea
                {...field}
                label="Message"
                description={`${firstName} reads this in the email and on their application page.`}
                required
                aria-required="true"
                autosize
                minRows={4}
                error={errors.message?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />

          <Controller
            control={control}
            name="letter"
            render={({ field }) => (
              <FileInput
                label="Offer letter"
                description="Optional. A PDF or Word document, up to 25 MB, that they can download."
                placeholder="Choose the letter"
                accept={OFFER_LETTER_ACCEPT}
                leftSection={<IconPaperclip size={16} aria-hidden />}
                value={field.value ?? null}
                onChange={(file) => field.onChange(file)}
                onBlur={field.onBlur}
                clearable
                clearButtonProps={{ 'aria-label': 'Remove the letter' }}
                error={errors.letter?.message}
                errorProps={{ role: 'alert' }}
              />
            )}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Sending…' : revised ? 'Send revised offer' : 'Send offer'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

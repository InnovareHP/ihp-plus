'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { describeMoment } from '@/lib/relative-time'
import { useAnswerOffer } from '../hooks/use-offers'
import {
  offerAnswerSchema,
  type OfferAnswerInput,
  type OfferAnswerValues,
  type PublicOffer,
} from '../schema'

export interface OfferResponseProps {
  offer: PublicOffer
  applicationId: string
  signature: string
  /** Where the letter downloads from, when one was attached. */
  letterHref: string | undefined
}

export function OfferResponse({ offer, applicationId, signature, letterHref }: OfferResponseProps) {
  const router = useRouter()
  const answer = useAnswerOffer()
  // Ephemeral: whether the decline form is open, which nothing else needs to know.
  const [declining, setDeclining] = useState(false)

  const { register, handleSubmit, setError, setFocus, setValue, formState } = useForm<
    OfferAnswerInput,
    unknown,
    OfferAnswerValues
  >({
    resolver: zodResolver(offerAnswerSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { applicationId, signature, offerId: offer.id, decision: 'accept', reason: '' },
  })

  async function submit(values: OfferAnswerValues) {
    try {
      await answer.mutateAsync(values)
      router.refresh()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not send your answer.',
      })
    }
  }

  function accept() {
    setValue('decision', 'accept')
    void handleSubmit(submit)()
  }

  function startDeclining() {
    setValue('decision', 'decline')
    setDeclining(true)
    // The reason box mounts on this render, so focus moves into it on the next tick.
    setTimeout(() => setFocus('reason'), 0)
  }

  function keepOffer() {
    setValue('decision', 'accept')
    setDeclining(false)
  }

  return (
    <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }}>
      <Stack gap="md">
        <Title order={2} size="h4">
          {offer.status === 'sent' ? 'You have an offer' : 'Your offer'}
        </Title>

        <Text style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{offer.message}</Text>

        {offer.fileName && letterHref ? (
          <Group gap={6} wrap="nowrap">
            <IconFileText size={18} aria-hidden />
            <Anchor href={letterHref} style={{ overflowWrap: 'anywhere' }}>
              Download your offer letter ({offer.fileName})
            </Anchor>
          </Group>
        ) : null}

        {offer.status === 'accepted' && offer.respondedAt ? (
          <Alert color="green" variant="light" title="You accepted this offer">
            Accepted {describeMoment(offer.respondedAt)}. We will email you an invitation to set up
            your account.
          </Alert>
        ) : null}

        {offer.status === 'declined' && offer.respondedAt ? (
          <Alert color="gray" variant="light" title="You declined this offer">
            Declined {describeMoment(offer.respondedAt)}. If we can offer you different terms, a
            revised offer will appear here and in your email.
          </Alert>
        ) : null}

        {offer.status === 'sent' ? (
          <form onSubmit={handleSubmit(submit)} noValidate>
            <Stack gap="md">
              <FormError
                message={formState.errors.root?.message}
                title="Could not send your answer"
              />

              {declining ? (
                <>
                  <Textarea
                    {...register('reason')}
                    label="Why are you declining?"
                    description="It stays between you and the hiring team, and helps them make a better offer."
                    required
                    aria-required="true"
                    autosize
                    minRows={3}
                    error={formState.errors.reason?.message}
                    errorProps={{ role: 'alert' }}
                  />
                  <Group>
                    <Button type="submit" color="red" loading={formState.isSubmitting}>
                      {formState.isSubmitting ? 'Sending…' : 'Decline offer'}
                    </Button>
                    <Button variant="default" disabled={formState.isSubmitting} onClick={keepOffer}>
                      Keep the offer
                    </Button>
                  </Group>
                </>
              ) : (
                <Group>
                  <Button loading={formState.isSubmitting} onClick={accept}>
                    {formState.isSubmitting ? 'Accepting…' : 'Accept offer'}
                  </Button>
                  <Button
                    variant="default"
                    disabled={formState.isSubmitting}
                    onClick={startDeclining}
                  >
                    Decline offer
                  </Button>
                </Group>
              )}
            </Stack>
          </form>
        ) : null}
      </Stack>
    </Paper>
  )
}

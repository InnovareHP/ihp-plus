'use client'

import { Alert, Button, Stack, Text } from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import { useState } from 'react'
import { PageSection } from '@/components/page-section'
import { offerLetterHref } from '@/lib/routes'
import type { ApplicationSummary, OfferRow } from '../schema'
import { OfferCard } from './offer-card'
import { SendOfferModal } from './send-offer-modal'

export interface ApplicationOffersProps {
  application: ApplicationSummary
  /** Newest first, as the server sends them. */
  offers: readonly OfferRow[]
  /** They sit in the offer stage, which is the only place a new offer can be made from. */
  inOfferStage: boolean
}

export function ApplicationOffers({ application, offers, inOfferStage }: ApplicationOffersProps) {
  // Ephemeral dialog state; the offer itself lives on the server once sent.
  const [sending, setSending] = useState(false)
  const [latest] = offers
  const firstName = application.fullName.split(/\s+/)[0] ?? application.fullName
  const canSend =
    application.status === 'active' &&
    inOfferStage &&
    latest?.status !== 'sent' &&
    latest?.status !== 'accepted'
  const revised = latest?.status === 'declined'

  return (
    <PageSection
      title="Offer"
      description={`${firstName} answers it from their application page.`}
      actions={
        canSend ? (
          <Button leftSection={<IconSend size={16} aria-hidden />} onClick={() => setSending(true)}>
            {revised ? 'Send a revised offer' : 'Send offer'}
          </Button>
        ) : null
      }
    >
      <Stack gap="sm">
        {latest?.status === 'accepted' && application.status === 'active' ? (
          <Alert color="green" variant="light" title={`${firstName} accepted`}>
            Hire them to send the invitation that sets up their portal account.
          </Alert>
        ) : null}
        {revised && canSend ? (
          <Alert color="orange" variant="light" title={`${firstName} declined`}>
            Read their reason below, then send a revised offer if you can change the terms.
          </Alert>
        ) : null}

        {offers.length === 0 ? (
          <Text size="sm" c="dimmed">
            {canSend
              ? `Send ${firstName} the offer, with the letter attached, and they accept or decline it online.`
              : 'Move them to the offer stage to send an offer.'}
          </Text>
        ) : (
          offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              letterHref={offer.fileName ? offerLetterHref(offer.id) : undefined}
            />
          ))
        )}
      </Stack>

      {sending ? (
        <SendOfferModal
          application={application}
          revised={revised}
          previousMessage={latest?.message}
          onClose={() => setSending(false)}
        />
      ) : null}
    </PageSection>
  )
}

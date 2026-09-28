'use client'

import type { ApplicationDecisions } from '../hooks/use-application-decisions'
import { MoveApplicationModal } from './move-application-modal'
import { RejectApplicationModal } from './reject-application-modal'

export interface DecisionModalsProps {
  decisions: ApplicationDecisions
  rejectionMessage: string
}

export function DecisionModals({ decisions, rejectionMessage }: DecisionModalsProps) {
  return (
    <>
      {decisions.moving ? (
        <MoveApplicationModal
          // A new target is a new form, so its message starts from that stage's own text.
          key={`${decisions.moving.application.id}:${decisions.moving.stage.id}`}
          application={decisions.moving.application}
          stage={decisions.moving.stage}
          onClose={decisions.closeMove}
          onConfirm={decisions.confirmMove}
        />
      ) : null}
      {decisions.rejecting ? (
        <RejectApplicationModal
          key={decisions.rejecting.id}
          application={decisions.rejecting}
          defaultMessage={rejectionMessage}
          onClose={decisions.closeReject}
          onConfirm={decisions.confirmReject}
        />
      ) : null}
    </>
  )
}

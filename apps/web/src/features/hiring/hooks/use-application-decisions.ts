'use client'

import { useState } from 'react'
import type { ApplicationSummary, MoveValues, RejectValues, Stage } from '../schema'
import { useMoveApplication, useRejectWithUndo, useReopenApplication } from './use-applications'

export interface PendingMove {
  application: ApplicationSummary
  stage: Stage
}

/**
 * The board, the list and the detail page decide an applicant the same way, so the dialog
 * state and the calls behind it live here once. A stage with no message moves at once.
 */
export function useApplicationDecisions() {
  const move = useMoveApplication()
  const reject = useRejectWithUndo()
  const reopen = useReopenApplication()
  // Ephemeral dialog state: which applicant a dialog is open for, and nothing a URL should hold.
  const [moving, setMoving] = useState<PendingMove | null>(null)
  const [rejecting, setRejecting] = useState<ApplicationSummary | null>(null)

  function requestMove(application: ApplicationSummary, stage: Stage) {
    if (stage.message) {
      setMoving({ application, stage })
      return
    }
    move.mutate({
      applicationId: application.id,
      stageId: stage.id,
      stage,
      sendEmail: false,
      message: '',
    })
  }

  function confirmMove(values: MoveValues) {
    if (moving) move.mutate({ ...values, stage: moving.stage })
    setMoving(null)
  }

  function confirmReject(values: RejectValues) {
    if (rejecting) void reject(values, rejecting.fullName)
    setRejecting(null)
  }

  return {
    moving,
    rejecting,
    requestMove,
    requestReject: setRejecting,
    reopen: (application: ApplicationSummary) => reopen.mutate(application.id),
    confirmMove,
    confirmReject,
    closeMove: () => setMoving(null),
    closeReject: () => setRejecting(null),
  }
}

export type ApplicationDecisions = ReturnType<typeof useApplicationDecisions>

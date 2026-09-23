'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import {
  decideCorrection,
  listCorrections,
  requestCorrection,
  withdrawCorrection,
  type CorrectionQuery,
} from '../rpc'
import type { AttendanceCorrectionRow, CorrectionDecisionValues, CorrectionValues } from '../schema'

const MINE = { everyone: false } as const
const QUEUE = { everyone: true, status: 'pending' } as const

export function useCorrections(query: CorrectionQuery) {
  return useQuery({
    queryKey: attendanceKeys.correctionList(query),
    queryFn: () => listCorrections(query),
    staleTime: 30 * 1000,
  })
}

export function useMyCorrections() {
  return useCorrections(MINE)
}

/** Only the requests still waiting; an admin's queue empties as they decide. */
export function useCorrectionQueue(enabled = true) {
  return useQuery({
    queryKey: attendanceKeys.correctionList(QUEUE),
    queryFn: () => listCorrections(QUEUE),
    enabled,
    staleTime: 30 * 1000,
  })
}

export function useRequestCorrection() {
  return useOptimisticListMutation<AttendanceCorrectionRow, CorrectionValues>({
    queryKey: attendanceKeys.correctionList(MINE),
    mutationFn: async (values) => {
      await requestCorrection(values)
    },
    // The server's id arrives with the refetch, so the pending row carries a temporary one.
    apply: (rows, values) => [
      {
        ...values,
        id: `pending-${crypto.randomUUID()}`,
        userId: '',
        userName: '',
        status: 'pending',
        decidedBy: undefined,
        decidedAt: undefined,
        decisionNote: undefined,
        createdAt: new Date().toISOString(),
        canDecide: false,
        isMine: true,
      },
      ...rows,
    ],
    successEvent: attendanceEvents.correctionRequested,
    failureEvent: attendanceEvents.correctionRequestFailed,
    alsoInvalidate: [attendanceKeys.corrections()],
  })
}

export function useWithdrawCorrection() {
  return useOptimisticListMutation<AttendanceCorrectionRow, { correctionId: string }>({
    queryKey: attendanceKeys.correctionList(MINE),
    mutationFn: async ({ correctionId }) => {
      await withdrawCorrection(correctionId)
    },
    apply: (rows, { correctionId }) =>
      rows.map((row) => (row.id === correctionId ? { ...row, status: 'withdrawn' } : row)),
    successEvent: attendanceEvents.correctionWithdrawn,
    failureEvent: attendanceEvents.correctionWithdrawFailed,
    alsoInvalidate: [attendanceKeys.corrections()],
  })
}

export function useDecideCorrection() {
  return useOptimisticListMutation<AttendanceCorrectionRow, CorrectionDecisionValues>({
    queryKey: attendanceKeys.correctionList(QUEUE),
    mutationFn: async (values) => {
      await decideCorrection(values)
    },
    // A decided request leaves the queue at once; a refusal puts it back, announced.
    apply: (rows, { correctionId }) => rows.filter((row) => row.id !== correctionId),
    successEvent: attendanceEvents.correctionDecided,
    failureEvent: attendanceEvents.correctionDecideFailed,
    // An approval rewrites the day, so every timesheet, board and calendar reads it again.
    alsoInvalidate: [attendanceKeys.all],
  })
}

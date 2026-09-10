'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { requestEvents } from './events'
import { requestKeys } from './query-keys'
import { listApprovers, setApprover } from './rpc'
import type { DepartmentApproversRow, SetApproverValues } from './schema'

export function useApprovers() {
  return useQuery({
    queryKey: requestKeys.approvers(),
    queryFn: listApprovers,
  })
}

export function useSetApprover() {
  return useOptimisticListMutation<
    DepartmentApproversRow,
    SetApproverValues & { name: string; email: string }
  >({
    queryKey: requestKeys.approvers(),
    mutationFn: async ({ teamId, userId, approver }) => {
      await setApprover({ teamId, userId, approver })
    },
    apply: (rows, values) =>
      rows.map((row) =>
        row.teamId !== values.teamId
          ? row
          : {
              ...row,
              approvers: values.approver
                ? [
                    ...row.approvers.filter((person) => person.userId !== values.userId),
                    { userId: values.userId, name: values.name, email: values.email },
                  ].sort((left, right) => left.name.localeCompare(right.name))
                : row.approvers.filter((person) => person.userId !== values.userId),
            },
      ),
    successEvent: requestEvents.approverAdded,
    failureEvent: requestEvents.approverChangeFailed,
  })
}

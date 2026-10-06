'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { balanceOf } from '../balance'
import { leaveEvents } from '../events'
import { leaveKeys } from '../query-keys'
import { setAllowance } from '../rpc'
import type { SetAllowanceValues, TeamLeaveBalances } from '../schema'

function withAllowance(team: TeamLeaveBalances, values: SetAllowanceValues): TeamLeaveBalances {
  const form = team.forms.find((one) => one.formId === values.formId)
  if (!form) return team

  return {
    ...team,
    people: team.people.map((person) =>
      person.userId !== values.userId
        ? person
        : {
            ...person,
            balances: person.balances.map((balance) =>
              balance.formId !== values.formId
                ? balance
                : balanceOf({
                    formId: balance.formId,
                    formName: balance.formName,
                    formAllowance: form.allowance,
                    override: values.days,
                    used: balance.used,
                    pending: balance.pending,
                  }),
            ),
          },
    ),
  }
}

/** The cell shows the new allowance the instant it is saved, and the old one if the server says no. */
export function useSetAllowance(year: number | undefined) {
  const queryClient = useQueryClient()
  const queryKey = leaveKeys.team(year)

  return useMutation({
    mutationFn: (values: SetAllowanceValues) => setAllowance(values),
    onMutate: async (values) => {
      // An in-flight refetch would land on top of the optimistic allowance.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<TeamLeaveBalances>(queryKey)
      if (previous) queryClient.setQueryData(queryKey, withAllowance(previous, values))
      return { previous }
    },
    onSuccess: (_person, values) => {
      track(values.days === undefined ? leaveEvents.allowanceCleared : leaveEvents.allowanceSet)
    },
    onError: (error: Error, _values, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
      track(leaveEvents.allowanceSetFailed, { reason: error.message })
      announceFailure(`Could not save the allowance — ${error.message}`)
    },
    onSettled: () => {
      // The person's own page reads the same allowance.
      void queryClient.invalidateQueries({ queryKey: leaveKeys.all })
    },
  })
}

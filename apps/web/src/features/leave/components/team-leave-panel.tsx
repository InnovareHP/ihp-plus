'use client'

import { Alert, Button, Skeleton, Stack } from '@mantine/core'
import { useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { LinkButton } from '@/components/link-button'
import { routes } from '@/lib/routes'
import { useTeamBalances } from '../hooks/use-balances'
import { useSetAllowance } from '../hooks/use-set-allowance'
import { AllowanceModal, type AllowanceTarget } from './allowance-modal'
import { TeamLeaveTable } from './team-leave-table'

export function TeamLeavePanel({ year }: { year: number | undefined }) {
  const team = useTeamBalances(year)
  const save = useSetAllowance(year)
  // Which cell's modal is open: ephemeral UI, not worth the URL.
  const [editing, setEditing] = useState<AllowanceTarget | undefined>()

  if (team.isPending) {
    return (
      <Stack gap="xs" aria-busy="true">
        <Skeleton height={38} />
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} height={52} />
        ))}
      </Stack>
    )
  }

  if (team.isError) {
    return (
      <Alert color="red" title="Could not load everyone’s leave" role="alert">
        {team.error.message} Check your connection and try again.
        <Button mt="sm" variant="light" color="red" onClick={() => void team.refetch()}>
          Try again
        </Button>
      </Alert>
    )
  }

  if (team.data.forms.length === 0) {
    return (
      <EmptyState
        title="No form tracks an allowance yet"
        description="Give a time off form a number of days per year and every person’s balance appears here."
        action={
          <LinkButton href={routes.requestForms} variant="light">
            Open request forms
          </LinkButton>
        }
      />
    )
  }

  return (
    <>
      <TeamLeaveTable
        forms={team.data.forms}
        people={team.data.people}
        onEdit={(person, balance, form) =>
          setEditing({
            userId: person.userId,
            name: person.name,
            balance,
            formAllowance: form.allowance,
          })
        }
      />
      <AllowanceModal
        target={editing}
        onClose={() => setEditing(undefined)}
        onSave={(target, days) =>
          save.mutate({ formId: target.balance.formId, userId: target.userId, days })
        }
      />
    </>
  )
}

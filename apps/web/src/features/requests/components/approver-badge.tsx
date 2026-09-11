'use client'

import { Badge, Button } from '@mantine/core'
import { useSetApprover } from '../hooks/use-approvers'
import type { DepartmentApproversRow } from '../schema'

export function ApproverBadge({
  department,
  approver,
}: {
  department: DepartmentApproversRow
  approver: DepartmentApproversRow['approvers'][number]
}) {
  const setApprover = useSetApprover()

  return (
    <Badge
      variant="light"
      size="lg"
      rightSection={
        <Button
          variant="transparent"
          size="compact-xs"
          color="red"
          px={0}
          aria-label={`Remove ${approver.name} as an approver for ${department.teamName}`}
          onClick={() =>
            setApprover.mutate({
              teamId: department.teamId,
              userId: approver.userId,
              approver: false,
              name: approver.name,
              email: approver.email,
            })
          }
        >
          Remove
        </Button>
      }
    >
      {approver.name}
    </Badge>
  )
}

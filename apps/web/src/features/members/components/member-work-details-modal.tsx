'use client'

import { Button, Modal, Stack, Text } from '@mantine/core'
import { DialogActions } from '@/components/dialog-actions'
import { MemberPaySelect } from '@/features/attendance/components/member-pay-select'
import { MemberShiftSelect } from '@/features/attendance/components/member-shift-select'
import { EmploymentStatusSelect } from './employment-status-select'

export interface MemberWorkDetailsModalProps {
  opened: boolean
  onClose: () => void
  userId: string
  userName: string
  employmentStatus: string | undefined
  statuses: readonly string[]
  onEmploymentStatusChange: (value: string) => void
}

// A phone's member card leaves these three out to stay short, so they open here instead.
export function MemberWorkDetailsModal({
  opened,
  onClose,
  userId,
  userName,
  employmentStatus,
  statuses,
  onEmploymentStatusChange,
}: MemberWorkDetailsModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={`Shift, pay and status for ${userName}`}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Each change saves as soon as you pick it.
        </Text>
        <MemberShiftSelect userId={userId} userName={userName} label="Shift" />
        <MemberPaySelect userId={userId} userName={userName} label="Pay basis" />
        <EmploymentStatusSelect
          userName={userName}
          value={employmentStatus}
          statuses={statuses}
          onChange={onEmploymentStatusChange}
          label="Employment status"
        />
        <DialogActions>
          <Button onClick={onClose}>Done</Button>
        </DialogActions>
      </Stack>
    </Modal>
  )
}

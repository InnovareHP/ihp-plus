'use client'

import { Button, Modal, Stack, Text } from '@mantine/core'
import { DialogActions } from '@/components/dialog-actions'
import { useDeleteTeam } from '../hooks/use-teams'
import type { TeamRow } from '../schema'

// Deleting a department is irreversible, so this one confirms rather than offering undo.
export function DeleteTeamModal({ team, onClose }: { team: TeamRow | null; onClose: () => void }) {
  const deleteTeam = useDeleteTeam()

  return (
    <Modal
      // A two-button question stays a small box on a phone, as native confirmations do.
      data-compact
      opened={Boolean(team)}
      onClose={onClose}
      title={`Delete ${team?.name ?? 'department'}?`}
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          Deleting {team?.name} cannot be undone. People already in it keep their profile but lose
          their department.
        </Text>
        <DialogActions>
          <Button variant="default" onClick={onClose}>
            Keep it
          </Button>
          <Button
            color="red"
            loading={deleteTeam.isPending}
            onClick={() => {
              if (!team) return
              deleteTeam.mutate({ teamId: team.id })
              onClose()
            }}
          >
            Delete department
          </Button>
        </DialogActions>
      </Stack>
    </Modal>
  )
}

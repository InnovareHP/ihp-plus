'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { useRenameTeam } from '../hooks/use-teams'
import { renameTeamSchema, type RenameTeamValues, type TeamRow } from '../schema'

export function RenameTeamModal({ team, onClose }: { team: TeamRow | null; onClose: () => void }) {
  const rename = useRenameTeam()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RenameTeamValues>({
    resolver: zodResolver(renameTeamSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: { teamId: team?.id ?? '', name: team?.name ?? '' },
  })

  async function onSubmit(values: RenameTeamValues) {
    try {
      await rename.mutateAsync(values)
    } catch (error) {
      setError('name', { message: error instanceof Error ? error.message : 'Could not rename.' })
      return
    }
    onClose()
  }

  return (
    <Modal opened={Boolean(team)} onClose={onClose} title={`Rename ${team?.name ?? ''}`} centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <TextInput
            {...register('name')}
            label="Department name"
            placeholder="Clinical Operations"
            required
            aria-required="true"
            error={errors.name?.message}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save name'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

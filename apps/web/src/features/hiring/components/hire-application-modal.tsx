'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
// Departments are organization data; hiring is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import { useHireApplication } from '../hooks/use-applications'
import type { ApplicationSummary } from '../schema'

const hireSchema = z.object({ teamId: z.string().trim().default('') })

type HireInput = z.input<typeof hireSchema>
type HireValues = z.infer<typeof hireSchema>

export interface HireApplicationModalProps {
  application: ApplicationSummary
  /** The posting's department, where a hire lands unless HR picks another. */
  defaultTeamId: string | undefined
  organizationName: string
  onClose: () => void
}

export function HireApplicationModal({
  application,
  defaultTeamId,
  organizationName,
  onClose,
}: HireApplicationModalProps) {
  const teams = useTeams()
  const hire = useHireApplication()
  const firstName = application.fullName.split(/\s+/)[0] ?? application.fullName

  const { control, handleSubmit, setError, formState } = useForm<HireInput, unknown, HireValues>({
    resolver: zodResolver(hireSchema),
    defaultValues: { teamId: defaultTeamId ?? '' },
  })

  async function onSubmit(values: HireValues) {
    try {
      const detail = await hire.mutateAsync({
        applicationId: application.id,
        teamId: values.teamId,
      })
      announceSuccess(
        detail.joined
          ? `${application.fullName} is marked hired.`
          : `Invitation sent to ${application.email}.`,
      )
      onClose()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not hire them — try again.',
      })
    }
  }

  return (
    <Modal opened onClose={onClose} title={`Hire ${application.fullName}?`} centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={formState.errors.root?.message} title="Could not hire them" />
          <Text size="sm">
            {firstName} gets an email inviting them to join {organizationName} at{' '}
            {application.email}. Once they accept and finish onboarding, their new-hire checklist
            starts on its own.
          </Text>
          <Controller
            control={control}
            name="teamId"
            render={({ field }) => (
              <Select
                label="Department they join"
                placeholder={teams.isPending ? 'Loading…' : 'They pick it during onboarding'}
                clearable
                searchable
                disabled={teams.isPending}
                data={(teams.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
              />
            )}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {formState.isSubmitting ? 'Sending…' : 'Hire and send invitation'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

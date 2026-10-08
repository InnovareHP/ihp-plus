'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { itTeamSchema, type ItTeamValues } from '../schema'

export interface ItDepartmentFormProps {
  itTeamId: string
  teams: readonly { id: string; name: string }[]
  teamsLoading: boolean
  onSave: (values: ItTeamValues) => Promise<void>
}

/** Admins pick which department sees this page; that department's lead runs the checks. */
export function ItDepartmentForm({ itTeamId, teams, teamsLoading, onSave }: ItDepartmentFormProps) {
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty, isSubmitSuccessful },
  } = useForm<ItTeamValues>({
    resolver: zodResolver(itTeamSchema),
    defaultValues: { itTeamId },
  })

  async function onSubmit(values: ItTeamValues) {
    try {
      await onSave(values)
      reset(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the department.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="sm">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not save the department">
            {errors.root.message}
          </Alert>
        ) : null}
        <Group align="flex-end" gap="xs" wrap="wrap">
          <Controller
            control={control}
            name="itTeamId"
            render={({ field }) => (
              <Select
                label="IT department"
                placeholder={teamsLoading ? 'Loading…' : 'Admins only'}
                data={teams.map((team) => ({ value: team.id, label: team.name }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                clearable
                searchable
                w={260}
              />
            )}
          />
          <Button type="submit" variant="default" loading={isSubmitting}>
            Save department
          </Button>
        </Group>
        {isSubmitSuccessful && !isDirty ? (
          <Text size="sm" c="dimmed" role="status">
            Saved. Its members see this page, and its lead runs the checks.
          </Text>
        ) : null}
      </Stack>
    </form>
  )
}

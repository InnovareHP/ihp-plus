'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Select, Stack, TextInput } from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import { announceSuccess } from '@/lib/announce'
import { useInviteMember } from '../hooks/use-invitations'
import { useTeams } from '../hooks/use-teams'
import { INVITABLE_ROLES, inviteMemberSchema, type InviteMemberValues } from '../schema'

const ROLE_OPTIONS = INVITABLE_ROLES.map((role) => ({
  value: role,
  label: role === 'admin' ? 'Admin' : 'Member',
}))

export function InviteForm({ invitedBy }: { invitedBy: string }) {
  const teams = useTeams()
  const invite = useInviteMember()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '', role: 'member', teamId: '' },
  })

  async function onSubmit(values: InviteMemberValues) {
    const teamName = teams.data?.find((team) => team.id === values.teamId)?.name ?? 'their team'

    try {
      await invite.mutateAsync({ ...values, teamName, invitedBy })
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Could not invite.' })
      return
    }

    reset({ email: '', role: values.role, teamId: values.teamId })
    announceSuccess(`Invitation sent to ${values.email}.`)
  }

  return (
    <PageSection
      title="Invite someone"
      description="They get a link to join this organization in the department you pick."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not send the invitation" />

          <TextInput
            {...register('email')}
            label="Work email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@innovarehp.com"
            required
            aria-required="true"
            error={errors.email?.message}
          />

          <Group grow align="flex-start">
            <Controller
              control={control}
              name="teamId"
              render={({ field }) => (
                <Select
                  label="Department"
                  // Both fields in the row need a description, or their inputs misalign.
                  description="They can be moved later."
                  placeholder={teams.isPending ? 'Loading…' : 'Pick a department'}
                  searchable
                  required
                  aria-required="true"
                  disabled={teams.isPending}
                  data={(teams.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? '')}
                  onBlur={field.onBlur}
                  error={errors.teamId?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select
                  label="Organization role"
                  placeholder="Pick a role"
                  description="Admins manage the organization."
                  data={ROLE_OPTIONS}
                  allowDeselect={false}
                  value={field.value}
                  onChange={(value) => value && field.onChange(value)}
                  onBlur={field.onBlur}
                  error={errors.role?.message}
                />
              )}
            />
          </Group>

          <Group>
            <Button
              type="submit"
              loading={isSubmitting}
              leftSection={<IconSend size={16} aria-hidden />}
            >
              {isSubmitting ? 'Sending…' : 'Send invite'}
            </Button>
          </Group>
        </Stack>
      </form>
    </PageSection>
  )
}

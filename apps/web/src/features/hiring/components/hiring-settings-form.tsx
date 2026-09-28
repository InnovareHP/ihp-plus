'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Select, Stack, Textarea } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import { announceSuccess } from '@/lib/announce'
// Departments are organization data; hiring is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import { useSaveHiringSettings } from '../hooks/use-hiring-settings'
import {
  hiringSettingsSchema,
  type HiringSettings,
  type HiringSettingsInput,
  type HiringSettingsValues,
} from '../schema'
import { StageListEditor } from './stage-list-editor'

function valuesOf(settings: HiringSettings): HiringSettingsInput {
  return {
    hrTeamId: settings.hrTeamId ?? '',
    defaultStages: settings.defaultStages,
    rejectionMessage: settings.rejectionMessage,
  }
}

export function HiringSettingsForm({ settings }: { settings: HiringSettings }) {
  const teams = useTeams()
  const save = useSaveHiringSettings()

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HiringSettingsInput, unknown, HiringSettingsValues>({
    resolver: zodResolver(hiringSettingsSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: valuesOf(settings),
  })

  async function onSubmit(values: HiringSettingsValues) {
    try {
      const saved = await save.mutateAsync(values)
      reset(valuesOf(saved))
      announceSuccess('Hiring settings saved.')
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the hiring settings.',
      })
    }
  }

  const stageErrors = Array.isArray(errors.defaultStages)
    ? errors.defaultStages.map((stage) =>
        stage ? { name: stage.name?.message, message: stage.message?.message } : undefined,
      )
    : []

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="xl">
        <FormError message={errors.root?.message} title="Could not save the hiring settings" />

        <PageSection
          title="Who runs hiring"
          description="Admins always can. Members of the department you pick here can too — they write postings and move applicants, without becoming admins."
          maw={720}
        >
          <Controller
            control={control}
            name="hrTeamId"
            render={({ field }) => (
              <Select
                label="HR department"
                description={
                  settings.canEditHrTeam
                    ? undefined
                    : 'Only an admin can change this, since it decides who may hire.'
                }
                placeholder={teams.isPending ? 'Loading…' : 'Admins only'}
                clearable
                searchable
                disabled={!settings.canEditHrTeam || teams.isPending}
                data={(teams.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                error={errors.hrTeamId?.message}
              />
            )}
          />
        </PageSection>

        <PageSection
          title="Default stages"
          description="Where every new posting starts. Each posting can change its own afterwards without touching the others."
          maw={720}
        >
          <Controller
            control={control}
            name="defaultStages"
            render={({ field }) => (
              <StageListEditor
                stages={field.value ?? []}
                onChange={field.onChange}
                errors={stageErrors}
                listError={errors.defaultStages?.message ?? errors.defaultStages?.root?.message}
              />
            )}
          />
        </PageSection>

        <PageSection
          title="Rejection email"
          description="What someone is sent when you turn their application down. You can still rewrite it for one person before it goes."
          maw={720}
        >
          <Textarea
            {...register('rejectionMessage')}
            label="Message"
            required
            aria-required="true"
            autosize
            minRows={4}
            error={errors.rejectionMessage?.message}
            errorProps={{ role: 'alert' }}
          />
        </PageSection>

        <Group>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {isSubmitting ? 'Saving…' : 'Save settings'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import { announceSuccess } from '@/lib/announce'
import { careersPostingRoute, NEW_APPLICATION_FORM_ROUTE, postingRoute } from '@/lib/routes'
// Departments are organization data and application forms are request forms; hiring consumes both.
import { useTeams } from '@/features/organization/hooks/use-teams'
import { usePublishedForms } from '@/features/requests/hooks/use-forms'
import { useSavePosting, useSetPostingStatus } from '../hooks/use-postings'
import {
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  POSTING_STATUS_COLORS,
  POSTING_STATUS_LABELS,
  postingDraftSchema,
  publishBlockers,
  WORKPLACE_LABELS,
  WORKPLACES,
  type PostingDraftInput,
  type PostingDraftValues,
  type PostingRow,
  type PostingStatus,
  type Stage,
} from '../schema'
import { StageListEditor } from './stage-list-editor'

const EMPLOYMENT_OPTIONS = EMPLOYMENT_TYPES.map((value) => ({
  value,
  label: EMPLOYMENT_TYPE_LABELS[value],
}))
const WORKPLACE_OPTIONS = WORKPLACES.map((value) => ({ value, label: WORKPLACE_LABELS[value] }))

function draftOf(
  posting: PostingRow | undefined,
  defaultStages: readonly Stage[],
): PostingDraftInput {
  return {
    postingId: posting?.id,
    title: posting?.title ?? '',
    summary: posting?.summary ?? '',
    description: posting?.description ?? '',
    location: posting?.location ?? '',
    workplace: posting?.workplace ?? 'onsite',
    employmentType: posting?.employmentType ?? 'full_time',
    salaryMin: posting?.salaryMin ?? '',
    salaryMax: posting?.salaryMax ?? '',
    salaryCurrency: posting?.salaryCurrency ?? 'USD',
    resumeRequired: posting?.resumeRequired ?? true,
    stages: posting?.stages ?? [...defaultStages],
    applicationFormId: posting?.applicationFormId ?? '',
    teamId: posting?.teamId ?? '',
    closesAt: posting?.closesAt?.slice(0, 10) ?? '',
  }
}

export interface PostingEditorProps {
  posting?: PostingRow
  /** The pipeline a new posting starts from, set in hiring settings. */
  defaultStages: readonly Stage[]
}

export function PostingEditor({ posting, defaultStages }: PostingEditorProps) {
  const router = useRouter()
  const teams = useTeams()
  const forms = usePublishedForms('application')
  const save = useSavePosting()
  const setStatus = useSetPostingStatus()

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PostingDraftInput, unknown, PostingDraftValues>({
    resolver: zodResolver(postingDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: draftOf(posting, defaultStages),
  })

  const description = useWatch({ control, name: 'description' }) ?? ''
  const stages = useWatch({ control, name: 'stages' }) ?? []
  const blockers = publishBlockers({ description, stages })
  const status: PostingStatus = posting?.status ?? 'draft'

  async function saveThen(values: PostingDraftValues, next?: PostingStatus) {
    try {
      const saved = await save.mutateAsync(values)
      if (next) await setStatus.mutateAsync({ postingId: saved.id, status: next })
      reset(draftOf(saved, defaultStages))
      announceSuccess(
        next === 'open'
          ? `${saved.title} is live on the careers page.`
          : next === 'closed'
            ? `${saved.title} stopped taking applications.`
            : `${saved.title} saved.`,
      )
      // A new posting has a real id now, so the URL stops saying "new".
      if (!values.postingId) router.replace(postingRoute(saved.id))
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save that posting.',
      })
    }
  }

  const stageErrors = Array.isArray(errors.stages)
    ? errors.stages.map((stage) =>
        stage ? { name: stage.name?.message, message: stage.message?.message } : undefined,
      )
    : []
  const stagesListError = errors.stages?.message ?? errors.stages?.root?.message

  return (
    <form onSubmit={handleSubmit((values) => saveThen(values))} noValidate>
      <Stack gap="xl">
        <FormError message={errors.root?.message} title="Could not save that posting" />

        <PageSection
          title="About the job"
          description="What an applicant sees on the careers page before they apply."
          actions={
            posting ? (
              <Group gap="xs">
                <Badge color={POSTING_STATUS_COLORS[status]} variant="light">
                  {POSTING_STATUS_LABELS[status]}
                </Badge>
                {status === 'open' ? (
                  <Anchor
                    component={Link}
                    href={careersPostingRoute(posting.slug)}
                    target="_blank"
                    size="sm"
                  >
                    <Group gap={4} wrap="nowrap" component="span">
                      View public page
                      <IconExternalLink size={14} aria-hidden />
                    </Group>
                  </Anchor>
                ) : null}
              </Group>
            ) : null
          }
        >
          <Stack gap="md">
            <TextInput
              {...register('title')}
              label="Job title"
              placeholder="Registered nurse"
              required
              aria-required="true"
              error={errors.title?.message}
              errorProps={{ role: 'alert' }}
            />
            <TextInput
              {...register('summary')}
              label="Summary"
              description="One line shown in the list of openings."
              placeholder="Care for patients across our outpatient clinics"
              error={errors.summary?.message}
              errorProps={{ role: 'alert' }}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Controller
                control={control}
                name="teamId"
                render={({ field }) => (
                  <Select
                    label="Department"
                    placeholder={teams.isPending ? 'Loading…' : 'No department'}
                    clearable
                    searchable
                    disabled={teams.isPending}
                    data={(teams.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? '')}
                    onBlur={field.onBlur}
                    error={errors.teamId?.message}
                  />
                )}
              />
              <TextInput
                {...register('location')}
                label="Location"
                placeholder="Manila"
                error={errors.location?.message}
                errorProps={{ role: 'alert' }}
              />
              <Controller
                control={control}
                name="employmentType"
                render={({ field }) => (
                  <Select
                    label="Employment type"
                    allowDeselect={false}
                    data={EMPLOYMENT_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? 'full_time')}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <Controller
                control={control}
                name="workplace"
                render={({ field }) => (
                  <Select
                    label="Workplace"
                    allowDeselect={false}
                    data={WORKPLACE_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? 'onsite')}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </SimpleGrid>
            <TextInput
              {...register('closesAt')}
              type="date"
              label="Stop taking applications on"
              description="Leave it empty to keep the posting open until you close it."
              maw={280}
              error={errors.closesAt?.message}
              errorProps={{ role: 'alert' }}
            />
          </Stack>
        </PageSection>

        <PageSection
          title="Pay"
          description="Optional. Postings that show a range tend to draw more applicants."
        >
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Controller
              control={control}
              name="salaryMin"
              render={({ field }) => (
                <NumberInput
                  label="From"
                  min={0}
                  thousandSeparator=","
                  allowDecimal={false}
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? '' : Number(value))}
                  onBlur={field.onBlur}
                  error={errors.salaryMin?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="salaryMax"
              render={({ field }) => (
                <NumberInput
                  label="To"
                  min={0}
                  thousandSeparator=","
                  allowDecimal={false}
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? '' : Number(value))}
                  onBlur={field.onBlur}
                  error={errors.salaryMax?.message}
                />
              )}
            />
            <TextInput
              {...register('salaryCurrency')}
              label="Currency"
              maxLength={3}
              autoCapitalize="characters"
              error={errors.salaryCurrency?.message}
              errorProps={{ role: 'alert' }}
            />
          </SimpleGrid>
        </PageSection>

        <PageSection
          title="Description"
          description="The role, what the day looks like, and what you are looking for. Blank lines start a new paragraph."
        >
          <Textarea
            {...register('description')}
            label="Job description"
            required
            aria-required="true"
            autosize
            minRows={8}
            error={errors.description?.message}
            errorProps={{ role: 'alert' }}
          />
        </PageSection>

        <PageSection
          title="Applying"
          description="Everyone gives their name, email and phone. Add a form for anything else you need to know."
        >
          <Stack gap="md">
            <Controller
              control={control}
              name="resumeRequired"
              render={({ field }) => (
                <Switch
                  label="Resume is required"
                  description="Off still lets an applicant attach one; they just do not have to."
                  checked={field.value ?? true}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={control}
              name="applicationFormId"
              render={({ field }) => (
                <Select
                  label="Extra questions"
                  description={
                    <>
                      A published application form.{' '}
                      <Anchor component={Link} href={NEW_APPLICATION_FORM_ROUTE} size="xs">
                        Build a new one
                      </Anchor>
                    </>
                  }
                  placeholder={forms.isPending ? 'Loading…' : 'No extra questions'}
                  clearable
                  disabled={forms.isPending}
                  data={(forms.data ?? []).map((form) => ({ value: form.id, label: form.name }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? '')}
                  onBlur={field.onBlur}
                  error={errors.applicationFormId?.message}
                />
              )}
            />
          </Stack>
        </PageSection>

        <PageSection
          title="Stages"
          description="The steps every applicant moves through, in order. Hired and rejected are always available on top of these."
        >
          <Controller
            control={control}
            name="stages"
            render={({ field }) => (
              <StageListEditor
                stages={field.value ?? []}
                onChange={field.onChange}
                errors={stageErrors}
                listError={stagesListError}
                counts={posting?.stageCounts}
              />
            )}
          />
        </PageSection>

        {status === 'draft' && blockers.length > 0 ? (
          <Alert color="yellow" variant="light" title="Not ready to publish">
            <Stack gap={2}>
              {blockers.map((blocker) => (
                <Text key={blocker} size="sm">
                  {blocker}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : null}

        <Group>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty && Boolean(posting)}>
            {isSubmitting ? 'Saving…' : status === 'draft' ? 'Save draft' : 'Save changes'}
          </Button>
          {status === 'draft' || status === 'closed' ? (
            <Button
              variant="light"
              disabled={blockers.length > 0 || isSubmitting}
              onClick={handleSubmit((values) => saveThen(values, 'open'))}
            >
              {status === 'draft' ? 'Publish' : 'Save and reopen'}
            </Button>
          ) : null}
          {status === 'open' ? (
            <Button
              variant="subtle"
              color="gray"
              disabled={isSubmitting}
              onClick={handleSubmit((values) => saveThen(values, 'closed'))}
            >
              Save and stop taking applications
            </Button>
          ) : null}
        </Group>
      </Stack>
    </form>
  )
}

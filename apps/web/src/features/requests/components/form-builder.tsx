'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Badge,
  Button,
  Group,
  MultiSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import { EmptyState } from '@/components/empty-state'
import { announceSuccess } from '@/lib/announce'
import { requestFormRoute } from '@/lib/routes'
// Departments are organization data; the requests feature is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import {
  formDraftSchema,
  publishBlockers,
  type FormDraftInput,
  type FormDraftValues,
  type FormRow,
} from '../schema'
import { useSaveForm, useSetFormStatus } from '../hooks/use-forms'
import { QuestionCard } from './question-card'

function draftOf(form: FormRow | undefined): FormDraftValues {
  return {
    formId: form?.id,
    name: form?.name ?? '',
    description: form?.description ?? '',
    fields: form?.fields ?? [],
    teamIds: form?.teams.map((team) => team.id) ?? [],
  }
}

export function FormBuilder({ form }: { form?: FormRow }) {
  const router = useRouter()
  const teams = useTeams()
  const save = useSaveForm()
  const setStatus = useSetFormStatus()

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormDraftInput, unknown, FormDraftValues>({
    resolver: zodResolver(formDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: draftOf(form),
  })

  const fields = useFieldArray({ control, name: 'fields' })
  // useWatch rather than watch(): the latter returns a function the React compiler cannot
  // memoize, and this value feeds the publish check on every keystroke.
  const watchedFields = useWatch({ control, name: 'fields' })
  const watchedTeamIds = useWatch({ control, name: 'teamIds' })

  const blockers = publishBlockers({
    fields: watchedFields ?? [],
    teams: watchedTeamIds ?? [],
  })

  async function onSubmit(values: FormDraftValues) {
    try {
      const saved = await save.mutateAsync(values)
      reset(draftOf(saved))
      announceSuccess(`${saved.name} saved.`)
      // A new form has a real id now, so the URL stops saying "new".
      if (!values.formId) router.replace(requestFormRoute(saved.id))
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save that form.',
      })
    }
  }

  async function onPublish(values: FormDraftValues) {
    try {
      const saved = await save.mutateAsync(values)
      await setStatus.mutateAsync({ formId: saved.id, status: 'published' })
      reset(draftOf({ ...saved, status: 'published' }))
      announceSuccess(`${saved.name} is live for the departments you picked.`)
      if (!values.formId) router.replace(requestFormRoute(saved.id))
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not publish that form.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="xl">
        <PageSection
          title="About this form"
          description="What requesters see in the catalogue before they open it."
          actions={
            form ? (
              <Badge variant="light" tt="capitalize">
                {form.status}
              </Badge>
            ) : null
          }
        >
          <Stack gap="md" maw={620}>
            <FormError message={errors.root?.message} title="Could not save that form" />

            <TextInput
              {...register('name')}
              label="Form name"
              placeholder="Equipment request"
              required
              aria-required="true"
              error={errors.name?.message}
              errorProps={{ role: 'alert' }}
            />

            <Textarea
              {...register('description')}
              label="Description"
              description="One line telling people when to use it."
              autosize
              minRows={2}
              error={errors.description?.message}
            />

            <Controller
              control={control}
              name="teamIds"
              render={({ field }) => (
                <MultiSelect
                  label="Departments"
                  description="Only these departments are offered the form."
                  placeholder={teams.isPending ? 'Loading…' : 'Pick departments'}
                  searchable
                  disabled={teams.isPending}
                  data={(teams.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.teamIds?.message}
                />
              )}
            />
          </Stack>
        </PageSection>

        <PageSection
          title="Questions"
          description="What the requester fills in. They are asked in this order."
          actions={
            <Button
              variant="default"
              leftSection={<IconPlus size={16} aria-hidden />}
              onClick={() =>
                fields.append({
                  id: crypto.randomUUID(),
                  type: 'text',
                  label: '',
                  help: '',
                  required: false,
                  options: [],
                })
              }
            >
              Add question
            </Button>
          }
        >
          {fields.fields.length === 0 ? (
            <EmptyState
              title="No questions yet"
              description="Add the first question and it appears here in the order requesters see."
              action={
                <Button
                  onClick={() =>
                    fields.append({
                      id: crypto.randomUUID(),
                      type: 'text',
                      label: '',
                      help: '',
                      required: false,
                      options: [],
                    })
                  }
                >
                  Add question
                </Button>
              }
            />
          ) : (
            <Stack gap="md">
              {fields.fields.map((field, index) => (
                <QuestionCard
                  key={field.id}
                  index={index}
                  total={fields.fields.length}
                  control={control}
                  register={register}
                  type={watchedFields?.[index]?.type ?? 'text'}
                  labelError={errors.fields?.[index]?.label?.message}
                  optionsError={errors.fields?.[index]?.options?.message}
                  onMoveUp={() => fields.swap(index, index - 1)}
                  onMoveDown={() => fields.swap(index, index + 1)}
                  onRemove={() => fields.remove(index)}
                />
              ))}
            </Stack>
          )}
        </PageSection>

        {blockers.length > 0 ? (
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
          <Button type="submit" loading={isSubmitting} disabled={!isDirty && Boolean(form)}>
            {isSubmitting ? 'Saving…' : 'Save draft'}
          </Button>
          <Button
            variant="light"
            disabled={blockers.length > 0 || isSubmitting}
            onClick={handleSubmit(onPublish)}
          >
            {form?.status === 'published' ? 'Save and republish' : 'Publish'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

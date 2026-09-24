'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Badge,
  Button,
  Group,
  MultiSelect,
  Stack,
  Switch,
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
import { evaluationFormRoute, requestFormRoute } from '@/lib/routes'
// Departments are organization data; the requests feature is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import {
  formDraftSchema,
  publishBlockers,
  type FormDraftInput,
  type FormDraftValues,
  type FormKind,
  type FormRow,
} from '../schema'
import { useSaveForm, useSetFormStatus } from '../hooks/use-forms'
import { isTimeOffField, withTimeOffFields } from '../time-off'
import { LockedQuestionCard } from './locked-question-card'
import { QuestionCard } from './question-card'

function draftOf(form: FormRow | undefined, kind: FormKind): FormDraftValues {
  return {
    formId: form?.id,
    kind: form?.kind ?? kind,
    name: form?.name ?? '',
    description: form?.description ?? '',
    fields: form?.fields ?? [],
    teamIds: form?.teams.map((team) => team.id) ?? [],
    timeOff: form?.timeOff ?? false,
  }
}

function editRoute(form: FormRow) {
  return form.kind === 'evaluation' ? evaluationFormRoute(form.id) : requestFormRoute(form.id)
}

export interface FormBuilderProps {
  form?: FormRow
  /** Which catalogue the form belongs to; it is settled on the first save. */
  kind?: FormKind
}

// One builder for both kinds: an evaluation form asks the same questions, it just reaches
// people by assignment rather than by department.
export function FormBuilder({ form, kind = 'request' }: FormBuilderProps) {
  const router = useRouter()
  const teams = useTeams()
  const save = useSaveForm()
  const formKind = form?.kind ?? kind
  const isEvaluation = formKind === 'evaluation'
  const setStatus = useSetFormStatus(formKind)

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormDraftInput, unknown, FormDraftValues>({
    resolver: zodResolver(formDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: draftOf(form, formKind),
  })

  const fields = useFieldArray({ control, name: 'fields' })
  // useWatch rather than watch(): the latter returns a function the React compiler cannot
  // memoize, and this value feeds the publish check on every keystroke.
  const watchedFields = useWatch({ control, name: 'fields' })
  const watchedTeamIds = useWatch({ control, name: 'teamIds' })
  const timeOff = useWatch({ control, name: 'timeOff' }) ?? false
  const lockedCount = timeOff
    ? (watchedFields ?? []).filter((field) => isTimeOffField(field.id)).length
    : 0

  const blockers = publishBlockers({
    kind: formKind,
    fields: watchedFields ?? [],
    teams: watchedTeamIds ?? [],
  })

  async function onSubmit(values: FormDraftValues) {
    try {
      const saved = await save.mutateAsync(values)
      reset(draftOf(saved, formKind))
      announceSuccess(`${saved.name} saved.`)
      // A new form has a real id now, so the URL stops saying "new".
      if (!values.formId) router.replace(editRoute(saved))
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
      reset(draftOf({ ...saved, status: 'published' }, formKind))
      announceSuccess(
        isEvaluation
          ? `${saved.name} is ready to assign.`
          : `${saved.name} is live for the departments you picked.`,
      )
      if (!values.formId) router.replace(editRoute(saved))
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
          description={
            isEvaluation
              ? 'What the supervisor sees before they open it.'
              : 'What requesters see in the catalogue before they open it.'
          }
          actions={
            form ? (
              <Badge variant="light" tt="capitalize">
                {form.status}
              </Badge>
            ) : null
          }
        >
          <Stack gap="md">
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
              placeholder="Use this to request equipment for a new hire"
              description="One line telling people when to use it."
              autosize
              minRows={2}
              error={errors.description?.message}
            />

            {isEvaluation ? null : (
              <Controller
                control={control}
                name="timeOff"
                render={({ field }) => (
                  <Switch
                    label="Time off request"
                    description={
                      form && form.submissionCount > 0
                        ? 'Already used, so this is settled: changing it would alter what approving those requests does.'
                        : 'Asks for the first and last day off, and books them on the time clock when approved.'
                    }
                    disabled={Boolean(form && form.submissionCount > 0)}
                    checked={field.value ?? false}
                    onChange={(event) => {
                      const on = event.currentTarget.checked
                      field.onChange(on)
                      const current = getValues('fields') ?? []
                      fields.replace(
                        on
                          ? withTimeOffFields(current as FormDraftValues['fields'])
                          : current.filter((one) => !isTimeOffField(one.id)),
                      )
                    }}
                  />
                )}
              />
            )}

            {isEvaluation ? null : (
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
            )}
          </Stack>
        </PageSection>

        <PageSection
          title="Questions"
          description={
            isEvaluation
              ? 'What the supervisor answers about the employee, in this order.'
              : 'What the requester fills in. They are asked in this order.'
          }
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
                  placeholder: '',
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
                      placeholder: '',
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
              {fields.fields.map((field, index) => {
                const current = watchedFields?.[index]
                if (timeOff && current && isTimeOffField(current.id)) {
                  return (
                    <LockedQuestionCard
                      key={field.id}
                      index={index}
                      label={current.label}
                      help={current.help ?? ''}
                    />
                  )
                }
                return (
                  <QuestionCard
                    key={field.id}
                    index={index}
                    firstMovableIndex={lockedCount}
                    allowFile={formKind === 'request'}
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
                )
              })}
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

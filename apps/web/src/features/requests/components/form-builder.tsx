'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
} from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { EmptyState, PageSection } from '@/components/page-shell'
import { announceSuccess } from '@/lib/announce'
import { requestFormRoute } from '@/lib/routes'
// Departments are organization data; the requests feature is a consumer of them.
import { useTeams } from '@/features/organization/use-teams'
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  formDraftSchema,
  publishBlockers,
  type FormDraftInput,
  type FormDraftValues,
  type FormRow,
} from '../schema'
import { useSaveForm, useSetFormStatus } from '../use-forms'

const TYPE_OPTIONS = FIELD_TYPES.map((type) => ({ value: type, label: FIELD_TYPE_LABELS[type] }))

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

interface QuestionCardProps {
  index: number
  total: number
  control: Control<FormDraftInput, unknown, FormDraftValues>
  register: UseFormRegister<FormDraftInput>
  type: FormDraftValues['fields'][number]['type']
  labelError: string | undefined
  optionsError: string | undefined
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

function QuestionCard({
  index,
  total,
  control,
  register,
  type,
  labelError,
  optionsError,
  onMoveUp,
  onMoveDown,
  onRemove,
}: QuestionCardProps) {
  return (
    <Card padding="md" component="fieldset" bd="1px solid var(--mantine-color-default-border)">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Text component="legend" size="sm" fw={600}>
          Question {index + 1}
        </Text>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            disabled={index === 0}
            aria-label={`Move question ${index + 1} up`}
            onClick={onMoveUp}
          >
            <IconArrowUp size={16} aria-hidden />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            disabled={index === total - 1}
            aria-label={`Move question ${index + 1} down`}
            onClick={onMoveDown}
          >
            <IconArrowDown size={16} aria-hidden />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={`Remove question ${index + 1}`}
            onClick={onRemove}
          >
            <IconTrash size={16} aria-hidden />
          </ActionIcon>
        </Group>
      </Group>

      <Stack gap="sm">
        <Group grow align="flex-start">
          <TextInput
            {...register(`fields.${index}.label`)}
            label="Label"
            required
            aria-required="true"
            error={labelError}
            errorProps={{ role: 'alert' }}
          />

          <Controller
            control={control}
            name={`fields.${index}.type`}
            render={({ field }) => (
              <Select
                label="Answer type"
                data={TYPE_OPTIONS}
                allowDeselect={false}
                value={field.value}
                onChange={(value) => value && field.onChange(value)}
                onBlur={field.onBlur}
              />
            )}
          />
        </Group>

        <TextInput
          {...register(`fields.${index}.help`)}
          label="Help text"
          description="Shown under the label, before anyone makes a mistake."
        />

        {type === 'select' ? (
          <Controller
            control={control}
            name={`fields.${index}.options`}
            render={({ field }) => (
              <TagsInput
                label="Options"
                description="Press Enter after each one."
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={optionsError}
              />
            )}
          />
        ) : null}

        {type === 'number' ? (
          <Group grow align="flex-start">
            <Controller
              control={control}
              name={`fields.${index}.min`}
              render={({ field }) => (
                <NumberInput
                  label="Lowest allowed"
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                  onBlur={field.onBlur}
                />
              )}
            />
            <Controller
              control={control}
              name={`fields.${index}.max`}
              render={({ field }) => (
                <NumberInput
                  label="Highest allowed"
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Group>
        ) : null}

        <Controller
          control={control}
          name={`fields.${index}.required`}
          render={({ field }) => (
            <Checkbox
              label="Required"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />
      </Stack>
    </Card>
  )
}

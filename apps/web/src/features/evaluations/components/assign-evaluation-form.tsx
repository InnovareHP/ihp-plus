'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, MultiSelect, Select, Stack, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
import { useForms } from '@/features/requests/hooks/use-forms'
import { useAssignEvaluations, useEvaluationCandidates } from '../hooks/use-evaluations'
import {
  assignEvaluationsSchema,
  type AssignEvaluationsInput,
  type AssignEvaluationsValues,
  type EvaluationCandidate,
} from '../schema'

function personLabel(person: EvaluationCandidate) {
  const detail = [person.team, person.employmentStatus].filter(Boolean).join(' · ')
  return detail ? `${person.name} — ${detail}` : person.name
}

export function AssignEvaluationForm({ onDone }: { onDone: () => void }) {
  const forms = useForms('evaluation')
  const candidates = useEvaluationCandidates()
  const assign = useAssignEvaluations()

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AssignEvaluationsInput, unknown, AssignEvaluationsValues>({
    resolver: zodResolver(assignEvaluationsSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { formId: '', evaluatorId: '', employeeIds: [], dueAt: '' },
  })

  const publishedForms = (forms.data ?? []).filter((form) => form.status === 'published')
  const people = candidates.data ?? []

  async function onSubmit(values: AssignEvaluationsValues) {
    try {
      const rows = await assign.mutateAsync(values)
      announceSuccess(
        rows.length === 1
          ? `${rows[0]?.employeeName} is now waiting to be evaluated.`
          : `${rows.length} evaluations are now waiting to be filled in.`,
      )
      onDone()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not assign that evaluation.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not assign that evaluation" />

        <Controller
          control={control}
          name="formId"
          render={({ field }) => (
            <Select
              label="Evaluation form"
              description="Only a published evaluation form can be assigned."
              placeholder={forms.isPending ? 'Loading…' : 'Pick a form'}
              required
              aria-required="true"
              searchable
              disabled={forms.isPending}
              data={publishedForms.map((form) => ({ value: form.id, label: form.name }))}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              onBlur={field.onBlur}
              error={errors.formId?.message}
              errorProps={{ role: 'alert' }}
            />
          )}
        />

        <Controller
          control={control}
          name="employeeIds"
          render={({ field }) => (
            <MultiSelect
              label="Employees"
              description="Who the evaluation is about."
              placeholder={candidates.isPending ? 'Loading…' : 'Pick people'}
              required
              aria-required="true"
              searchable
              disabled={candidates.isPending}
              data={people.map((person) => ({ value: person.userId, label: personLabel(person) }))}
              value={field.value ?? []}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.employeeIds?.message}
              errorProps={{ role: 'alert' }}
            />
          )}
        />

        <Controller
          control={control}
          name="evaluatorId"
          render={({ field }) => (
            <Select
              label="Supervisor"
              description="Who fills it in about them."
              placeholder={candidates.isPending ? 'Loading…' : 'Pick a supervisor'}
              required
              aria-required="true"
              searchable
              disabled={candidates.isPending}
              data={people.map((person) => ({ value: person.userId, label: personLabel(person) }))}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              onBlur={field.onBlur}
              error={errors.evaluatorId?.message}
              errorProps={{ role: 'alert' }}
            />
          )}
        />

        <TextInput
          {...register('dueAt')}
          label="Due date"
          description="Optional. The supervisor is chased by the date, not by a person."
          type="date"
          error={errors.dueAt?.message}
          errorProps={{ role: 'alert' }}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Assigning…' : 'Assign evaluation'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

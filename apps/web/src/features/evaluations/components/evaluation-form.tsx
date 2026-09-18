'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stack, Text } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useForm, type Control, type FieldValues } from 'react-hook-form'
import { EmptyState } from '@/components/empty-state'
import { FieldInput } from '@/components/field-input'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import { announceSuccess } from '@/lib/announce'
import { evaluationRoute, routes } from '@/lib/routes'
import { answerSchemaOf, defaultAnswersOf, type RequestValues } from '@/features/requests/schema'
import { useSubmitEvaluation } from '../hooks/use-evaluations'
import type { EvaluationRow } from '../schema'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export function EvaluationForm({ evaluation }: { evaluation: EvaluationRow }) {
  const router = useRouter()
  const submit = useSubmitEvaluation()

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    resolver: zodResolver(answerSchemaOf(evaluation.fields)),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaultAnswersOf(evaluation.fields),
  })

  async function onSubmit(values: FieldValues) {
    try {
      await submit.mutateAsync({
        evaluationId: evaluation.id,
        fields: evaluation.fields,
        values: values as RequestValues,
      })
      announceSuccess(`Your evaluation of ${evaluation.employeeName} is recorded.`)
      // The user lands on what they filled in, not back on an empty form.
      router.replace(evaluationRoute(evaluation.id))
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not submit that evaluation.',
      })
    }
  }

  if (evaluation.fields.length === 0) {
    return (
      <EmptyState
        title="This evaluation has no questions yet"
        description="An admin still has to add them. Nothing can be submitted until they do."
      />
    )
  }

  return (
    <PageSection
      title="Your answers"
      maw={680}
      description={
        evaluation.dueAt
          ? `Due by ${dateOnly.format(new Date(evaluation.dueAt))}.`
          : 'There is no due date on this one.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="lg">
          <FormError message={errors.root?.message} title="Could not submit that evaluation" />

          <Stack gap="md">
            {evaluation.fields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                control={control as Control<FieldValues>}
                error={errors[field.id]?.message as string | undefined}
              />
            ))}
          </Stack>

          <Text size="sm" c="dimmed">
            Nobody approves this. Once submitted, it is the record of your evaluation of{' '}
            {evaluation.employeeName}.
          </Text>

          <Group>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit evaluation'}
            </Button>
            <Button variant="subtle" color="gray" onClick={() => router.push(routes.evaluations)}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </PageSection>
  )
}

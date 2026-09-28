'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Radio, Stack, Text } from '@mantine/core'
import { Controller, useForm, type Control, type FieldValues } from 'react-hook-form'
import { FieldInput } from '@/components/field-input'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
import { describeMoment } from '@/lib/relative-time'
import { defaultAnswersOf, type FormField, type RequestValues } from '@/features/requests/schema'
import { useSubmitScorecard } from '../hooks/use-scorecard'
import {
  RECOMMENDATION_LABELS,
  RECOMMENDATIONS,
  scorecardSchemaOf,
  type Recommendation,
  type ScorecardRow,
} from '../schema'

export interface ScorecardFormProps {
  interviewId: string
  applicantName: string
  fields: readonly FormField[]
  mine: ScorecardRow | undefined
}

// One form whether it is the first answer or a later change; the server keeps one per interviewer.
export function ScorecardForm({ interviewId, applicantName, fields, mine }: ScorecardFormProps) {
  const submit = useSubmitScorecard()

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FieldValues>({
    resolver: zodResolver(scorecardSchemaOf(fields)),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      ...defaultAnswersOf(fields),
      ...mine?.values,
      recommendation: mine?.recommendation ?? '',
    },
  })

  async function onSubmit(values: FieldValues) {
    const { recommendation, ...answers } = values
    try {
      await submit.mutateAsync({
        interviewId,
        recommendation: recommendation as Recommendation,
        fields,
        answers: answers as RequestValues,
      })
      announceSuccess(`Your scorecard for ${applicantName} is saved.`)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save your scorecard.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="lg">
        <FormError message={errors.root?.message} title="Could not save your scorecard" />

        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            control={control as Control<FieldValues>}
            error={errors[field.id]?.message as string | undefined}
          />
        ))}

        <Controller
          control={control}
          name="recommendation"
          render={({ field }) => (
            <Radio.Group
              label={`Overall, should we hire ${applicantName}?`}
              required
              value={String(field.value ?? '')}
              onChange={field.onChange}
              error={errors.recommendation?.message as string | undefined}
              errorProps={{ role: 'alert' }}
            >
              <Group gap="md" mt="xs">
                {RECOMMENDATIONS.map((value) => (
                  <Radio key={value} value={value} label={RECOMMENDATION_LABELS[value]} />
                ))}
              </Group>
            </Radio.Group>
          )}
        />

        <Group align="center">
          <Button type="submit" loading={isSubmitting} disabled={Boolean(mine) && !isDirty}>
            {isSubmitting ? 'Saving…' : mine ? 'Save changes' : 'Submit scorecard'}
          </Button>
          {mine ? (
            <Text size="xs" c="dimmed">
              Last saved {describeMoment(mine.updatedAt)}
            </Text>
          ) : null}
        </Group>
      </Stack>
    </form>
  )
}

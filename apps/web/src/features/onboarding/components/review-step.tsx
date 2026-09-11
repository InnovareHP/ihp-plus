'use client'

import { Checkbox, Stack, Text } from '@mantine/core'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import type { OnboardingValues } from '../schema'
import { ReviewSection } from './review-section'

export interface ReviewStepProps {
  form: UseFormReturn<OnboardingValues>
  email: string
  teams: readonly { value: string; label: string }[]
  onEdit: (step: number) => void
}

const EMPTY = 'Not provided'
const CONFIRM_ERROR_ID = 'onboarding-confirm-error'

function formatDate(value: string | undefined) {
  if (!value) return EMPTY
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00.000Z`),
  )
}

function text(value: string | undefined) {
  return value && value.trim() !== '' ? value : EMPTY
}

export function ReviewStep({ form, email, teams, onEdit }: ReviewStepProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const values = useWatch({ control })
  const confirmError = errors.confirmed?.message

  const personal = [
    {
      label: 'Legal name',
      value: [values.firstName, values.middleInitial, values.lastName].filter(Boolean).join(' '),
    },
    { label: 'Preferred name', value: text(values.preferredName) },
    { label: 'Email', value: email },
    { label: 'Phone', value: text(values.phone) },
    { label: 'Date of birth', value: formatDate(values.dateOfBirth) },
  ]

  const employment = [
    { label: 'Position', value: text(values.jobTitle) },
    { label: 'Department', value: text(teams.find((t) => t.value === values.teamId)?.label) },
    { label: 'Employment type', value: text(values.employmentType) },
    { label: 'Start date', value: formatDate(values.startDate) },
  ]

  return (
    <Stack gap="md">
      <ReviewSection
        title="About you"
        editLabel="Edit about you"
        onEdit={() => onEdit(0)}
        rows={personal}
      />
      <ReviewSection
        title="Your role"
        editLabel="Edit your role"
        onEdit={() => onEdit(1)}
        rows={employment}
      />

      <Stack gap={4}>
        <Checkbox
          {...register('confirmed')}
          label="These details are correct."
          required
          aria-required="true"
          aria-invalid={confirmError ? 'true' : undefined}
          aria-describedby={confirmError ? CONFIRM_ERROR_ID : undefined}
          error={Boolean(confirmError)}
        />
        {confirmError ? (
          <Text id={CONFIRM_ERROR_ID} role="alert" size="sm" c="red.7">
            {confirmError}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  )
}

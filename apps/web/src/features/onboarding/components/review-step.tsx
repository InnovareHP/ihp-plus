'use client'

import { Button, Checkbox, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import type { OnboardingValues } from '../schema'

export interface ReviewStepProps {
  form: UseFormReturn<OnboardingValues>
  email: string
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

export function ReviewStep({ form, email, onEdit }: ReviewStepProps) {
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
    { label: 'Department', value: text(values.department) },
    { label: 'Employment type', value: text(values.employmentType) },
    { label: 'Start date', value: formatDate(values.startDate) },
    { label: 'Employee ID', value: text(values.employeeId) },
  ]

  return (
    <Stack gap="md">
      <Section
        title="About you"
        editLabel="Edit about you"
        onEdit={() => onEdit(0)}
        rows={personal}
      />
      <Section
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

interface SectionProps {
  title: string
  editLabel: string
  onEdit: () => void
  rows: readonly { label: string; value: string }[]
}

function Section({ title, editLabel, onEdit, rows }: SectionProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="center" mb="sm">
        <Title order={3} size="h6">
          {title}
        </Title>
        <Button variant="subtle" size="compact-sm" onClick={onEdit} aria-label={editLabel}>
          Edit
        </Button>
      </Group>
      <Stack component="dl" gap="xs" m={0}>
        {rows.map((row) => (
          <Group key={row.label} gap="xs" align="baseline" wrap="wrap">
            <Text component="dt" size="sm" c="dimmed" miw={150}>
              {row.label}
            </Text>
            <Text component="dd" size="sm" m={0}>
              {row.value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}

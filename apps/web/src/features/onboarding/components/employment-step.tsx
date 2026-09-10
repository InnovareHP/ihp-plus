'use client'

import { Select, Stack, TextInput } from '@mantine/core'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { EMPLOYMENT_TYPES, POSITIONS } from '../options'
import { NARROW_INPUT } from '../field-styles'
import type { OnboardingValues } from '../schema'

export interface TeamOption {
  value: string
  label: string
}

export interface EmploymentStepProps {
  form: UseFormReturn<OnboardingValues>
  teams: readonly TeamOption[]
}

export function EmploymentStep({ form, teams }: EmploymentStepProps) {
  const {
    control,
    register,
    formState: { errors },
  } = form

  return (
    <Stack gap="md">
      <Controller
        control={control}
        name="jobTitle"
        render={({ field }) => (
          <Select
            label="Current position"
            placeholder="Choose a position"
            data={POSITIONS}
            allowDeselect={false}
            required
            aria-required="true"
            name={field.name}
            ref={field.ref}
            value={field.value ?? null}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.jobTitle?.message}
            errorProps={{ role: 'alert' }}
          />
        )}
      />

      <Controller
        control={control}
        name="teamId"
        render={({ field }) => (
          <Select
            label="Department"
            placeholder="Choose a department"
            data={teams}
            allowDeselect={false}
            required
            aria-required="true"
            name={field.name}
            ref={field.ref}
            value={field.value ?? null}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.teamId?.message}
            errorProps={{ role: 'alert' }}
          />
        )}
      />

      <Controller
        control={control}
        name="employmentType"
        render={({ field }) => (
          <Select
            label="Employment type"
            placeholder="Choose an employment type"
            data={EMPLOYMENT_TYPES}
            allowDeselect={false}
            required
            aria-required="true"
            name={field.name}
            ref={field.ref}
            value={field.value ?? null}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.employmentType?.message}
            errorProps={{ role: 'alert' }}
          />
        )}
      />

      <TextInput
        {...register('startDate')}
        label="Start date"
        description="The first day of your current position."
        type="date"
        styles={NARROW_INPUT}
        required
        aria-required="true"
        error={errors.startDate?.message}
        errorProps={{ role: 'alert' }}
      />
    </Stack>
  )
}

'use client'

import { Select, Stack, TextInput } from '@mantine/core'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { DEPARTMENTS, EMPLOYMENT_TYPES, POSITIONS } from '../options'
import type { OnboardingValues } from '../schema'

export interface EmploymentStepProps {
  form: UseFormReturn<OnboardingValues>
}

export function EmploymentStep({ form }: EmploymentStepProps) {
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
        name="department"
        render={({ field }) => (
          <Select
            label="Department"
            placeholder="Choose a department"
            data={DEPARTMENTS}
            allowDeselect={false}
            required
            aria-required="true"
            name={field.name}
            ref={field.ref}
            value={field.value ?? null}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.department?.message}
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
        maw={240}
        required
        aria-required="true"
        error={errors.startDate?.message}
        errorProps={{ role: 'alert' }}
      />

      <TextInput
        {...register('employeeId')}
        label="Employee ID"
        description="Optional. Leave blank if HR has not issued one yet."
        maw={240}
        error={errors.employeeId?.message}
        errorProps={{ role: 'alert' }}
      />
    </Stack>
  )
}

'use client'

import { Fieldset, Stack, TextInput } from '@mantine/core'
import type { UseFormReturn } from 'react-hook-form'
import type { OnboardingValues } from '../schema'

export interface PersonalStepProps {
  form: UseFormReturn<OnboardingValues>
  email: string
}

export function PersonalStep({ form, email }: PersonalStepProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <Stack gap="lg">
      <Fieldset legend="Legal name" variant="unstyled">
        <Stack gap="md">
          <TextInput
            {...register('firstName')}
            label="First name"
            autoComplete="given-name"
            required
            aria-required="true"
            error={errors.firstName?.message}
            errorProps={{ role: 'alert' }}
          />
          <TextInput
            {...register('middleInitial')}
            label="Middle initial"
            description="Optional."
            maxLength={1}
            maw={140}
            autoComplete="additional-name"
            error={errors.middleInitial?.message}
            errorProps={{ role: 'alert' }}
          />
          <TextInput
            {...register('lastName')}
            label="Last name"
            autoComplete="family-name"
            required
            aria-required="true"
            error={errors.lastName?.message}
            errorProps={{ role: 'alert' }}
          />
        </Stack>
      </Fieldset>

      <Fieldset legend="How we reach you" variant="unstyled">
        <Stack gap="md">
          <TextInput
            label="Email address"
            value={email}
            readOnly
            variant="filled"
            description="Your sign-in address."
          />
          <TextInput
            {...register('preferredName')}
            label="Preferred name"
            description="Optional. What colleagues should call you if it differs from your legal name."
            autoComplete="nickname"
            error={errors.preferredName?.message}
            errorProps={{ role: 'alert' }}
          />
          <TextInput
            {...register('phone')}
            label="Phone number"
            description="Optional. Needed only if you turn on text-message verification."
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            errorProps={{ role: 'alert' }}
          />
          <TextInput
            {...register('dateOfBirth')}
            label="Date of birth"
            description="Optional. Used for benefits eligibility only."
            type="date"
            autoComplete="bday"
            maw={240}
            error={errors.dateOfBirth?.message}
            errorProps={{ role: 'alert' }}
          />
        </Stack>
      </Fieldset>
    </Stack>
  )
}

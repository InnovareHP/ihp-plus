'use client'

import { Fieldset, Stack, Text, TextInput } from '@mantine/core'
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
      <Fieldset legend={<Legend>Legal name</Legend>} variant="unstyled">
        <Stack gap="md">
          <TextInput
            {...register('firstName')}
            label="First name"
            placeholder="Dana"
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
            placeholder="R"
            maxLength={1}
            autoComplete="additional-name"
            error={errors.middleInitial?.message}
            errorProps={{ role: 'alert' }}
          />
          <TextInput
            {...register('lastName')}
            label="Last name"
            placeholder="Reyes"
            autoComplete="family-name"
            required
            aria-required="true"
            error={errors.lastName?.message}
            errorProps={{ role: 'alert' }}
          />
        </Stack>
      </Fieldset>

      <Fieldset legend={<Legend>How we reach you</Legend>} variant="unstyled">
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
            placeholder="Dee"
            autoComplete="nickname"
            error={errors.preferredName?.message}
            errorProps={{ role: 'alert' }}
          />
          <TextInput
            {...register('phone')}
            label="Phone number"
            description="Optional. Needed only if you turn on text-message verification."
            placeholder="(609) 555-0134"
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
            placeholder="mm/dd/yyyy"
            type="date"
            autoComplete="bday"
            error={errors.dateOfBirth?.message}
            errorProps={{ role: 'alert' }}
          />
        </Stack>
      </Fieldset>
    </Stack>
  )
}

// An unstyled fieldset renders its legend as plain body text, which reads as help text.
function Legend({ children }: { children: string }) {
  return (
    <Text component="span" size="sm" fw={600}>
      {children}
    </Text>
  )
}

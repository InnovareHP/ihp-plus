'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stepper, Text, VisuallyHidden } from '@mantine/core'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useForm, type DefaultValues } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { track } from '@/lib/analytics'
import { routes } from '@/lib/routes'
import { onboardingEvents } from '../events'
import {
  LAST_STEP,
  ONBOARDING_STEPS,
  onboardingSchema,
  stepFields,
  type OnboardingField,
  type OnboardingValues,
} from '../schema'
import { useCompleteOnboarding } from '../use-complete-onboarding'
import { EmploymentStep } from './employment-step'
import { PersonalStep } from './personal-step'
import { PhotoStep } from './photo-step'
import { ReviewStep } from './review-step'

export interface OnboardingStepperProps {
  email: string
  photoUrl: string | undefined
  defaultValues: DefaultValues<OnboardingValues>
}

function clampStep(raw: string | null) {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (Number.isNaN(parsed)) return 0
  return Math.min(Math.max(parsed, 0), LAST_STEP)
}

export function OnboardingStepper({ email, photoUrl, defaultValues }: OnboardingStepperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const step = clampStep(searchParams.get('step'))
  const complete = useCompleteOnboarding()

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues,
  })
  const {
    handleSubmit,
    trigger,
    setFocus,
    setError,
    getFieldState,
    formState: { errors, isSubmitting },
  } = form

  const started = useRef(false)

  // Analytics is an external system, so the funnel's start event fires once on first paint.
  useEffect(() => {
    if (started.current) return
    started.current = true
    track(onboardingEvents.started)
  }, [])

  function goToStep(next: number) {
    router.push(`${routes.onboarding}?step=${next}`)
  }

  function focusFirstInvalid(fields: readonly OnboardingField[]) {
    const invalid = fields.find((field) => getFieldState(field).invalid)
    if (invalid) setFocus(invalid)
  }

  async function handleNext() {
    const fields = stepFields(step)
    if (!(await trigger(fields as OnboardingField[]))) {
      focusFirstInvalid(fields)
      return
    }
    track(onboardingEvents.stepCompleted, { step: step + 1 })
    goToStep(step + 1)
  }

  // A deep link can land on the review step with earlier answers missing, so send the user back.
  function onInvalid() {
    const owner = ONBOARDING_STEPS.findIndex((candidate) =>
      candidate.fields.some((field) => getFieldState(field).invalid),
    )
    if (owner !== -1 && owner !== step) {
      setError('root', { message: 'Some answers are still missing — we took you back to them.' })
      goToStep(owner)
      return
    }
    focusFirstInvalid(stepFields(step))
  }

  async function onSubmit(values: OnboardingValues) {
    try {
      await complete.mutateAsync(values)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save your profile — try again.'
      track(onboardingEvents.failed, { reason: message })
      setError('root', { message })
      return
    }

    track(onboardingEvents.completed)
    router.replace(routes.dashboard)
    router.refresh()
  }

  const current = ONBOARDING_STEPS[step] ?? ONBOARDING_STEPS[0]

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
      <Text size="sm" c="dimmed" mb="md">
        Step {step + 1} of {ONBOARDING_STEPS.length}
      </Text>
      <VisuallyHidden aria-live="polite">
        Step {step + 1} of {ONBOARDING_STEPS.length}: {current.label}
      </VisuallyHidden>

      <Stepper
        active={step}
        onStepClick={goToStep}
        allowNextStepsSelect={false}
        size="sm"
        contentPadding="xl"
      >
        <Stepper.Step
          label={ONBOARDING_STEPS[0].label}
          description={ONBOARDING_STEPS[0].description}
        >
          <PersonalStep form={form} email={email} />
        </Stepper.Step>
        <Stepper.Step
          label={ONBOARDING_STEPS[1].label}
          description={ONBOARDING_STEPS[1].description}
        >
          <EmploymentStep form={form} />
        </Stepper.Step>
        <Stepper.Step
          label={ONBOARDING_STEPS[2].label}
          description={ONBOARDING_STEPS[2].description}
        >
          <PhotoStep form={form} initialPhotoUrl={photoUrl} />
        </Stepper.Step>
        <Stepper.Step
          label={ONBOARDING_STEPS[3].label}
          description={ONBOARDING_STEPS[3].description}
        >
          <ReviewStep form={form} email={email} onEdit={goToStep} />
        </Stepper.Step>
      </Stepper>

      <FormError message={errors.root?.message} title="Could not finish setup" />

      <Group justify="space-between" mt="xl">
        {step > 0 ? (
          <Button type="button" variant="default" onClick={() => goToStep(step - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}

        {step < LAST_STEP ? (
          <Button type="button" onClick={handleNext}>
            Continue
          </Button>
        ) : (
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Finish setup'}
          </Button>
        )}
      </Group>
    </form>
  )
}

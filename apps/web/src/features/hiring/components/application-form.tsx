'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, Checkbox, Fieldset, Stack, Text, TextInput } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { Controller, useForm, type Control, type FieldValues } from 'react-hook-form'
import { FieldInput } from '@/components/field-input'
import { FormError } from '@/components/form-error'
import { track } from '@/lib/analytics'
import { defaultAnswersOf, type RequestValues } from '@/features/requests/schema'
import { hiringEvents } from '../events'
import { useSubmitApplication } from '../hooks/use-apply'
import {
  applicationSchemaOf,
  RESUME_FIELD_ID,
  type ContactValues,
  type PublicPosting,
} from '../schema'
import { ApplicationFileInput } from './application-file-input'

export interface ApplicationFormProps {
  posting: PublicPosting
  organizationName: string
}

const EMPTY_CONTACT = {
  fullName: '',
  email: '',
  phone: '',
  resumeId: '',
  consent: false,
  website: '',
}

export function ApplicationForm({ posting, organizationName }: ApplicationFormProps) {
  const router = useRouter()
  const submit = useSubmitApplication()
  const started = useRef(false)
  const fields = posting.applicationFields

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    resolver: zodResolver(applicationSchemaOf(posting)),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { ...defaultAnswersOf(fields), contact: EMPTY_CONTACT },
  })

  const contactErrors = (errors.contact ?? {}) as Partial<
    Record<keyof ContactValues, { message?: string }>
  >

  async function onSubmit(values: FieldValues) {
    const { contact, ...answers } = values
    try {
      const sent = await submit.mutateAsync({
        slug: posting.slug,
        contact: contact as ContactValues,
        answers: answers as RequestValues,
      })
      // The applicant lands on their own application, not back on an empty form.
      router.replace(sent.statusPath)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not send your application.',
      })
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      // The funnel's first step is the first field touched, not merely opening the page.
      onFocusCapture={() => {
        if (started.current) return
        started.current = true
        track(hiringEvents.applyStarted)
      }}
    >
      <Stack gap="xl">
        <FormError message={errors.root?.message} title="Could not send your application" />

        <Fieldset legend="About you" variant="unstyled">
          <Stack gap="md">
            <TextInput
              {...register('contact.fullName')}
              label="Full name"
              autoComplete="name"
              required
              aria-required="true"
              error={contactErrors.fullName?.message}
              errorProps={{ role: 'alert' }}
            />
            <TextInput
              {...register('contact.email')}
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-required="true"
              error={contactErrors.email?.message}
              errorProps={{ role: 'alert' }}
            />
            <TextInput
              {...register('contact.phone')}
              label="Phone"
              description="Optional, if you would rather we call."
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              error={contactErrors.phone?.message}
              errorProps={{ role: 'alert' }}
            />
            <Controller
              control={control}
              name="contact.resumeId"
              render={({ field }) => (
                <ApplicationFileInput
                  slug={posting.slug}
                  fieldId={RESUME_FIELD_ID}
                  label="Resume"
                  required={posting.resumeRequired}
                  value={String(field.value ?? '')}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={contactErrors.resumeId?.message}
                />
              )}
            />
          </Stack>
        </Fieldset>

        {fields.length > 0 ? (
          <Fieldset legend="A few questions" variant="unstyled">
            <Stack gap="md">
              {fields.map((field) =>
                field.type === 'file' ? (
                  <Controller
                    key={field.id}
                    control={control}
                    name={field.id}
                    render={({ field: bound }) => (
                      <ApplicationFileInput
                        slug={posting.slug}
                        fieldId={field.id}
                        label={field.label}
                        description={field.help}
                        placeholder={field.placeholder}
                        required={field.required}
                        value={String(bound.value ?? '')}
                        onChange={bound.onChange}
                        onBlur={bound.onBlur}
                        error={errors[field.id]?.message as string | undefined}
                      />
                    )}
                  />
                ) : (
                  <FieldInput
                    key={field.id}
                    field={field}
                    control={control as Control<FieldValues>}
                    error={errors[field.id]?.message as string | undefined}
                  />
                ),
              )}
            </Stack>
          </Fieldset>
        ) : null}

        {/* Hidden from people and screen readers alike; only a bot filling every input finds it. */}
        <Box display="none" aria-hidden="true">
          <TextInput
            {...register('contact.website')}
            label="Leave this empty"
            tabIndex={-1}
            autoComplete="off"
          />
        </Box>

        <Controller
          control={control}
          name="contact.consent"
          render={({ field }) => (
            <Checkbox
              label={`${organizationName} may keep my details to review this application. They are deleted 12 months after it is decided.`}
              required
              aria-required="true"
              checked={Boolean(field.value)}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
              error={contactErrors.consent?.message}
            />
          )}
        />

        <Stack gap={4}>
          <Button type="submit" loading={isSubmitting} w="fit-content">
            {isSubmitting ? 'Sending…' : 'Send application'}
          </Button>
          <Text size="xs" c="dimmed">
            You get an email with a link to check where your application stands.
          </Text>
        </Stack>
      </Stack>
    </form>
  )
}

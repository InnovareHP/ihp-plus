'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Divider, PasswordInput, Stack, TextInput } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { authClient } from '@/lib/auth-client'
import { invitationRoute, verifyEmailRoute, withBasePath } from '@/lib/routes'
import { authErrorMessage } from '../messages'
import { invitationSignupSchema, type InvitationSignupValues } from '../schema'
import { OutlookButton } from './outlook-button'

export interface InvitationSignupFormProps {
  invitationId: string
  email: string
}

/** An account is only ever created from an open invitation, so the address is fixed here. */
export function InvitationSignupForm({ invitationId, email }: InvitationSignupFormProps) {
  const router = useRouter()
  const back = invitationRoute(invitationId)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvitationSignupValues>({
    resolver: zodResolver(invitationSignupSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: InvitationSignupValues) {
    const { error } = await authClient.signUp.email({
      // signUp.email requires a name; onboarding replaces this with the real one.
      name: email.split('@')[0] ?? email,
      email,
      password: values.password,
      // Confirming the address signs them in and drops them back on this invitation.
      callbackURL: withBasePath(back),
    })

    if (error) {
      setError('root', { message: authErrorMessage(error) })
      return
    }

    router.replace(verifyEmailRoute(email, back))
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not create your account" />

        <TextInput
          label="Email address"
          value={email}
          readOnly
          disabled
          description="The address this invitation was sent to."
          autoComplete="email"
        />

        <PasswordInput
          {...register('password')}
          label="Password"
          description="At least 12 characters."
          autoComplete="new-password"
          required
          aria-required="true"
          error={errors.password?.message}
          errorProps={{ role: 'alert' }}
        />

        <PasswordInput
          {...register('confirmPassword')}
          label="Confirm password"
          autoComplete="new-password"
          required
          aria-required="true"
          error={errors.confirmPassword?.message}
          errorProps={{ role: 'alert' }}
        />

        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Creating your account…' : 'Create account'}
        </Button>

        <Divider label="or" labelPosition="center" />

        <OutlookButton callbackPath={back} onFailure={(message) => setError('root', { message })} />
      </Stack>
    </form>
  )
}

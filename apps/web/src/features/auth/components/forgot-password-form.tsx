'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Stack, TextInput } from '@mantine/core'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { authClient } from '@/lib/auth-client'
import { routes, withBasePath } from '@/lib/routes'
import { authErrorMessage } from '../messages'
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schema'
import { FormError } from './form-error'

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: withBasePath(routes.resetPassword),
    })
    if (error) setError('root', { message: authErrorMessage(error) })
  }

  if (isSubmitSuccessful) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="green" title="Check your inbox" variant="light">
          If that address has an account, a reset link is on its way. The link expires in one hour.
        </Alert>
        <Anchor component={Link} href={routes.login} size="sm">
          Back to sign in
        </Anchor>
      </Stack>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not send the reset link" />

        <TextInput
          {...register('email')}
          label="Email address (required)"
          placeholder="you@innovarehp.com"
          type="email"
          autoComplete="email"
          required
          aria-required="true"
          error={errors.email?.message}
          errorProps={{ role: 'alert' }}
        />

        <Button type="submit" loading={isSubmitting}>
          Send reset link
        </Button>

        <Anchor component={Link} href={routes.login} size="sm">
          Back to sign in
        </Anchor>
      </Stack>
    </form>
  )
}

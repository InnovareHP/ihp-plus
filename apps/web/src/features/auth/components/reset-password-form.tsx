'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, PasswordInput, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'
import { authErrorMessage } from '../messages'
import { resetPasswordSchema, type ResetPasswordValues } from '../schema'
import { FormError } from './form-error'

export function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPasswordValues) {
    if (!token) {
      setError('root', { message: 'That reset link is missing its token. Request a new one.' })
      return
    }

    const { error } = await authClient.resetPassword({ newPassword: values.password, token })

    if (error) {
      setError('root', { message: authErrorMessage(error) })
      return
    }

    notifications.show({ color: 'green', message: 'Password updated. Sign in with it now.' })
    router.replace(routes.login)
  }

  if (!token) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" title="That link is not usable" variant="light">
          The reset link is missing its token, which usually means it was truncated by an email
          client. Request a fresh one.
        </Alert>
        <Anchor component={Link} href={routes.forgotPassword} size="sm">
          Request a new reset link
        </Anchor>
      </Stack>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not reset your password" />

        <PasswordInput
          {...register('password')}
          label="New password"
          description="At least 12 characters."
          autoComplete="new-password"
          required
          aria-required="true"
          error={errors.password?.message}
          errorProps={{ role: 'alert' }}
        />

        <PasswordInput
          {...register('confirmPassword')}
          label="Confirm new password"
          autoComplete="new-password"
          required
          aria-required="true"
          error={errors.confirmPassword?.message}
          errorProps={{ role: 'alert' }}
        />

        <Button type="submit" loading={isSubmitting}>
          Set new password
        </Button>
      </Stack>
    </form>
  )
}

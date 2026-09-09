'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Anchor, Button, Divider, PasswordInput, Stack, TextInput } from '@mantine/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'
import { authErrorMessage } from '../messages'
import { signupSchema, type SignupValues } from '../schema'
import { OutlookButton } from './outlook-button'

export function SignupForm() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values: SignupValues) {
    const { error } = await authClient.signUp.email({
      // signUp.email requires a name; onboarding replaces this with the real one.
      name: values.email.split('@')[0] ?? values.email,
      email: values.email,
      password: values.password,
    })

    if (error) {
      // An address collision belongs on the field that caused it, not in the summary.
      if (error.code === 'USER_ALREADY_EXISTS') {
        setError('email', { message: authErrorMessage(error) })
        return
      }
      setError('root', { message: authErrorMessage(error) })
      return
    }

    router.replace(routes.onboarding)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not create your account" />

        <TextInput
          {...register('email')}
          label="Email address"
          placeholder="you@innovarehp.com"
          type="email"
          autoComplete="email"
          required
          aria-required="true"
          error={errors.email?.message}
          errorProps={{ role: 'alert' }}
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
          Create account
        </Button>

        <Divider label="or" labelPosition="center" />

        <OutlookButton
          callbackPath={routes.onboarding}
          onFailure={(message) => setError('root', { message })}
        />

        <Anchor component={Link} href={routes.login} size="sm" ta="center">
          Already have an account? Sign in
        </Anchor>
      </Stack>
    </form>
  )
}

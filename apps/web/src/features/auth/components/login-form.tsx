'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Anchor, Button, Checkbox, Divider, PasswordInput, Stack, TextInput } from '@mantine/core'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { authClient } from '@/lib/auth-client'
import { routes, safeNextRoute } from '@/lib/routes'
import { authErrorMessage } from '../messages'
import { loginSchema, type LoginValues } from '../schema'
import { OutlookButton } from './outlook-button'

export function LoginForm() {
  const router = useRouter()
  const next = safeNextRoute(useSearchParams().get('next'))

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  async function onSubmit(values: LoginValues) {
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: values.rememberMe,
    })

    if (error) {
      setError('root', { message: authErrorMessage(error) })
      return
    }

    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} />

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
          autoComplete="current-password"
          required
          aria-required="true"
          error={errors.password?.message}
          errorProps={{ role: 'alert' }}
        />

        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <Checkbox
              label="Keep me signed in"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />

        <Button type="submit" loading={isSubmitting}>
          Sign in
        </Button>

        <Anchor component={Link} href={routes.forgotPassword} size="sm">
          Forgot your password?
        </Anchor>

        <Divider label="or" labelPosition="center" />

        <OutlookButton callbackPath={next} onFailure={(message) => setError('root', { message })} />

        <Anchor component={Link} href={routes.signup} size="sm" ta="center">
          No account yet? Create one
        </Anchor>
      </Stack>
    </form>
  )
}

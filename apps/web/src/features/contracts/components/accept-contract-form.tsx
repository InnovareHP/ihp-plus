'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Checkbox, Stack, Text, TextInput } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { track } from '@/lib/analytics'
import { acceptContract } from '../accept-actions'
import { contractEvents } from '../events'
import { contractAcceptanceFormSchema, type ContractAcceptanceFormValues } from '../schema'

export interface AcceptContractFormProps {
  contractId: string
  signature: string
  clientName: string
}

export function AcceptContractForm({ contractId, signature, clientName }: AcceptContractFormProps) {
  const router = useRouter()
  const agreeErrorId = useId()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContractAcceptanceFormValues>({
    resolver: zodResolver(contractAcceptanceFormSchema),
    defaultValues: { fullName: '', agree: false },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  })

  async function onSubmit(values: ContractAcceptanceFormValues) {
    track(contractEvents.clientAcceptStarted)

    const result = await acceptContract({ ...values, contractId, signature }).catch(() => ({
      ok: false as const,
      message: 'Could not reach the portal. Check your connection and try again.',
    }))

    if (!result.ok) {
      track(contractEvents.clientAcceptFailed, { reason: result.message })
      setError('root', { message: result.message })
      return
    }

    track(contractEvents.clientAccepted)
    // The page re-reads the contract on the server and renders it as accepted.
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <FormError message={errors.root?.message} title="Could not accept this contract" />

        <TextInput
          label="Your full name"
          placeholder="Dana Reyes"
          description="Typing your name is your signature on this contract."
          autoComplete="name"
          required
          error={errors.fullName?.message}
          errorProps={{ role: 'alert' }}
          {...register('fullName')}
        />

        {/* Checkbox has no errorProps, so its message is rendered here to carry role="alert". */}
        <Stack gap={4}>
          <Checkbox
            label={`I have read this contract and agree to it on behalf of ${clientName}`}
            error={Boolean(errors.agree)}
            aria-invalid={Boolean(errors.agree)}
            aria-describedby={errors.agree ? agreeErrorId : undefined}
            {...register('agree')}
          />
          {errors.agree ? (
            <Text id={agreeErrorId} role="alert" size="xs" c="red">
              {errors.agree.message}
            </Text>
          ) : null}
        </Stack>

        <Button type="submit" loading={isSubmitting} w="fit-content">
          {isSubmitting ? 'Accepting…' : 'Accept contract'}
        </Button>
      </Stack>
    </form>
  )
}

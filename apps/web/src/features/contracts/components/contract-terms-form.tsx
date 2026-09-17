'use client'

import { Button, Group, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import type { ContractTemplateValues } from '../schema'
import { useUpdateContractTemplate } from '../use-contracts'

export function ContractTermsForm({ defaultValues }: { defaultValues: ContractTemplateValues }) {
  const update = useUpdateContractTemplate()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContractTemplateValues>({ defaultValues })

  async function onSubmit(values: ContractTemplateValues) {
    try {
      await update.mutateAsync(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the terms.',
      })
      return
    }
    reset(values)
  }

  return (
    <PageSection
      title="Contract terms"
      description="What every new contract starts from. A contract can still be edited before it is agreed."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not save the terms" />

          <Textarea
            {...register('scopeTemplate')}
            label="Scope checklist"
            description="The scope controls every proposal states, filled in per contract."
            autosize
            minRows={6}
            maxRows={16}
          />

          <Textarea
            {...register('standardTerms')}
            label="Standard terms and conditions"
            description="Payment, excluded costs, ownership and cancellation. Appended after the scope."
            autosize
            minRows={8}
            maxRows={20}
          />

          <Group>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {isSubmitting ? 'Saving…' : 'Save terms'}
            </Button>
          </Group>
        </Stack>
      </form>
    </PageSection>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-section'
import { announceSuccess } from '@/lib/announce'
import { useUpdateOrganizationProfile } from '../hooks/use-organization'
import { organizationProfileSchema, type OrganizationProfileValues } from '../schema'

export function OrganizationProfileForm({
  defaultValues,
}: {
  defaultValues: OrganizationProfileValues
}) {
  const router = useRouter()
  const update = useUpdateOrganizationProfile()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrganizationProfileValues>({
    resolver: zodResolver(organizationProfileSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues,
  })

  async function onSubmit(values: OrganizationProfileValues) {
    try {
      await update.mutateAsync(values)
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Could not save.' })
      return
    }

    reset(values)
    announceSuccess('Organization details saved.')
    // The sidebar reads the name from the server, so it stays stale without a refresh.
    router.refresh()
  }

  return (
    <PageSection
      title="Company profile"
      description="The name shown in the portal header and the slug used in links."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not save the organization" />

          {/* Paired rather than stacked: two fields fill the card without either becoming a
              text input the width of the page. */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {/* Both fields in the row carry a description, or their inputs sit at
                different heights. */}
            <TextInput
              {...register('name')}
              label="Organization name"
              placeholder="Innovare Health Partners"
              description="Shown in the portal header."
              required
              aria-required="true"
              autoComplete="organization"
              error={errors.name?.message}
            />

            <TextInput
              {...register('slug')}
              label="Slug"
              placeholder="innovare-health"
              description="Lowercase letters, numbers and hyphens."
              required
              aria-required="true"
              error={errors.slug?.message}
            />
          </SimpleGrid>

          <TextInput
            {...register('logo')}
            label="Logo URL"
            placeholder="https://innovarehp.com/logo.svg"
            description="Optional. Leave blank to keep the default mark."
            type="url"
            inputMode="url"
            error={errors.logo?.message}
          />

          <Group>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </Group>
        </Stack>
      </form>
    </PageSection>
  )
}

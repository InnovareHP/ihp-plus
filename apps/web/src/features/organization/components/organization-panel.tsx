'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { PageSection } from '@/components/page-shell'
import { announceSuccess } from '@/lib/announce'
import { organizationProfileSchema, type OrganizationProfileValues } from '../schema'
import { useOrganizationSummary, useUpdateOrganizationProfile } from '../use-organization'

const number = new Intl.NumberFormat('en-US')

export function OrganizationPanel() {
  const summary = useOrganizationSummary()

  if (summary.isPending) return <OrganizationSkeleton />

  if (summary.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load this organization">
          <Text size="sm">{summary.error.message}</Text>
        </Alert>
        <Button onClick={() => summary.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard label="People" value={summary.data.memberCount} hint="Members of this company" />
        <StatCard
          label="Departments"
          value={summary.data.teamCount}
          hint="Teams you can assign to"
        />
        <StatCard
          label="Pending invitations"
          value={summary.data.pendingInvitationCount}
          hint="Sent and not yet accepted"
        />
        <StatCard
          label="Without a department"
          value={summary.data.unassignedCount}
          hint="They see no department on their dashboard"
        />
      </SimpleGrid>

      <ProfileForm
        key={summary.data.id}
        defaultValues={{
          name: summary.data.name,
          slug: summary.data.slug,
          logo: summary.data.logo,
        }}
      />
    </>
  )
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card padding="lg">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz={32} fw={700} lh={1.2}>
        {number.format(value)}
      </Text>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
    </Card>
  )
}

function ProfileForm({ defaultValues }: { defaultValues: OrganizationProfileValues }) {
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
        <Stack gap="md" maw={520}>
          <FormError message={errors.root?.message} title="Could not save the organization" />

          <TextInput
            {...register('name')}
            label="Organization name"
            required
            aria-required="true"
            autoComplete="organization"
            error={errors.name?.message}
          />

          <TextInput
            {...register('slug')}
            label="Slug"
            description="Lowercase letters, numbers and hyphens."
            required
            aria-required="true"
            error={errors.slug?.message}
          />

          <TextInput
            {...register('logo')}
            label="Logo URL"
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

function OrganizationSkeleton() {
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" aria-busy="true">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height={116} radius="md" />
        ))}
      </SimpleGrid>
      <Card padding="lg">
        <Title order={2} size="h5" mb="md">
          Company profile
        </Title>
        <Stack gap="md" maw={520}>
          <Skeleton height={60} />
          <Skeleton height={76} />
          <Skeleton height={76} />
          <Skeleton height={36} width={140} />
        </Stack>
      </Card>
    </>
  )
}

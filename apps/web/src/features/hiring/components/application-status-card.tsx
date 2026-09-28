'use client'

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { careersPostingRoute, routes } from '@/lib/routes'
import { useWithdrawApplication } from '../hooks/use-apply'
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatusView,
} from '../schema'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })

const STATUS_COPY: Record<ApplicationStatusView['status'], string> = {
  active: 'Our team is reviewing it. We will email you when there is news.',
  hired: 'Congratulations — look out for an email inviting you to join.',
  rejected: 'We are not moving forward with this application. Thank you for your time.',
  withdrawn: 'You withdrew this application, so it is no longer being reviewed.',
}

export interface ApplicationStatusCardProps {
  application: ApplicationStatusView
  signature: string
}

export function ApplicationStatusCard({ application, signature }: ApplicationStatusCardProps) {
  const router = useRouter()
  const withdraw = useWithdrawApplication()
  const [confirming, confirm] = useDisclosure(false)

  async function onWithdraw() {
    try {
      await withdraw.mutateAsync({ applicationId: application.id, signature })
      confirm.close()
      router.refresh()
    } catch {
      // The error renders inside the dialog from the mutation's own state.
    }
  }

  return (
    <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }}>
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {application.organizationName}
          </Text>
          <Title order={1} size="h3">
            Your application for {application.postingTitle}
          </Title>
        </Stack>

        <Group gap="xs">
          <Badge color={APPLICATION_STATUS_COLORS[application.status]} variant="light">
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
          {application.status === 'active' ? (
            <Text size="sm">Stage: {application.stageName}</Text>
          ) : null}
        </Group>

        <Text>
          Hi {application.firstName}. {STATUS_COPY[application.status]}
        </Text>
        <Text size="sm" c="dimmed">
          Applied {date.format(new Date(application.appliedAt))} · last updated{' '}
          {date.format(new Date(application.updatedAt))}
        </Text>

        <Group gap="md">
          <Anchor component={Link} href={careersPostingRoute(application.postingSlug)} size="sm">
            Read the job posting again
          </Anchor>
          <Anchor component={Link} href={routes.careers} size="sm">
            See other openings
          </Anchor>
        </Group>

        {application.status === 'active' ? (
          <Group>
            <Button variant="subtle" color="red" onClick={confirm.open}>
              Withdraw application
            </Button>
          </Group>
        ) : null}
      </Stack>

      <Modal
        opened={confirming}
        onClose={confirm.close}
        title={`Withdraw your application for ${application.postingTitle}?`}
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            It stops being reviewed straight away, and this cannot be undone. You can apply again
            later while the role is open.
          </Text>
          {withdraw.error ? (
            <Alert color="red" variant="light" role="alert">
              {withdraw.error.message}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={confirm.close}>
              Keep my application
            </Button>
            <Button color="red" loading={withdraw.isPending} onClick={onWithdraw}>
              {withdraw.isPending ? 'Withdrawing…' : 'Withdraw application'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}

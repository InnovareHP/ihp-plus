import { Anchor, Avatar, Badge, Card, Group, Stack, Text } from '@mantine/core'
import { IconMail, IconPhone } from '@tabler/icons-react'
import { initialsOf, type PersonRow } from '../schema'

export function PersonCard({ person }: { person: PersonRow }) {
  return (
    <Card component="article" padding="md" withBorder>
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Avatar src={person.photoUrl || undefined} size={56} radius="md" alt="">
            {initialsOf(person.name)}
          </Avatar>
          <Stack gap={2} miw={0}>
            <Group gap={6} wrap="nowrap">
              <Text fw={600} lineClamp={1}>
                {person.name}
              </Text>
              {person.isLead ? (
                <Badge size="xs" variant="light">
                  Lead
                </Badge>
              ) : null}
            </Group>
            <Text size="sm" c="dimmed" lineClamp={2}>
              {person.jobTitle || 'No job title'}
            </Text>
            <Text size="xs" c="dimmed">
              {person.department || 'No department'}
            </Text>
          </Stack>
        </Group>

        <Stack gap={4}>
          <Group gap={6} wrap="nowrap">
            <IconMail size={14} aria-hidden />
            {/* mailto rather than plain text: a directory is for getting in touch. */}
            <Anchor href={`mailto:${person.email}`} size="sm" lineClamp={1}>
              {person.email}
            </Anchor>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconPhone size={14} aria-hidden />
            {person.phone ? (
              <Anchor href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} size="sm">
                {person.phone}
              </Anchor>
            ) : (
              <Text size="sm" c="dimmed">
                No phone
              </Text>
            )}
          </Group>
        </Stack>

        {person.ihpId ? (
          <Text size="xs" c="dimmed" ff="monospace">
            {person.ihpId}
          </Text>
        ) : null}
      </Stack>
    </Card>
  )
}

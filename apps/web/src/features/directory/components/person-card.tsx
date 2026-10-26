import { Anchor, Avatar, Badge, Card, Group, Stack, Text } from '@mantine/core'
import { IconMail, IconPhone } from '@tabler/icons-react'
import touch from '@/components/touch-target.module.css'
import { initialsOf, type PersonRow } from '../schema'
import classes from './person-card.module.css'

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
              <Text fw={600} lineClamp={1} miw={0}>
                {person.name}
              </Text>
              {person.isLead ? (
                <Badge size="xs" variant="light" flex="none">
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

        <Stack gap="xs">
          <Group gap={6} wrap="nowrap">
            <IconMail size={14} aria-hidden style={{ flexShrink: 0 }} />
            {/* mailto rather than plain text: a directory is for getting in touch. */}
            <Anchor
              href={`mailto:${person.email}`}
              size="sm"
              miw={0}
              className={touch.target}
              title={person.email}
            >
              <Text span inherit lineClamp={2} className={classes.email}>
                {person.email}
              </Text>
            </Anchor>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconPhone size={14} aria-hidden style={{ flexShrink: 0 }} />
            {person.phone ? (
              <Anchor
                href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}
                size="sm"
                className={touch.target}
              >
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

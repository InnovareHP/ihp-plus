'use client'

import { Card, Group, Stack, Table, Text, UnstyledButton, VisuallyHidden } from '@mantine/core'
import { IconChevronRight, IconNote } from '@tabler/icons-react'
import { formatDate } from '../utils/day-report'
import type { WebsiteRow } from '../schema'
import { CheckStatusText } from './check-status-text'
import { ManualResultText } from './manual-result-text'

export interface WebsiteTableProps {
  websites: readonly WebsiteRow[]
  timeZone: string
  /** Phones get one card per site instead of a table that would scroll sideways. */
  narrow: boolean
  onOpen: (websiteId: string) => void
}

function shortUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

function FormEmailText({ website }: { website: WebsiteRow }) {
  if (!website.formEmail) {
    return (
      <Text size="sm" c="dimmed">
        Not tested
      </Text>
    )
  }
  return <ManualResultText result={website.formEmail.result} />
}

function hasFindings(website: WebsiteRow) {
  return Boolean(website.shift.findings || website.shift.action)
}

function OpenButton({ website, onOpen }: { website: WebsiteRow; onOpen: (id: string) => void }) {
  return (
    <UnstyledButton
      onClick={(event) => {
        event.stopPropagation()
        onOpen(website.id)
      }}
      aria-label={`${website.name}, open details`}
      style={{ display: 'block', minWidth: 0 }}
    >
      <Text size="sm" fw={600} truncate>
        {website.name}
      </Text>
      <Text size="xs" c="dimmed" truncate>
        {shortUrl(website.url)}
      </Text>
    </UnstyledButton>
  )
}

/** Every site on one screen; the details live in the side panel a row opens. */
export function WebsiteTable({ websites, timeZone, narrow, onOpen }: WebsiteTableProps) {
  if (narrow) {
    return (
      <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
        {websites.map((website) => (
          <Card component="li" key={website.id} withBorder padding="sm">
            <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
              <OpenButton website={website} onOpen={onOpen} />
              <IconChevronRight size={18} aria-hidden />
            </Group>
            <Group gap="md" wrap="wrap">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">
                  Time in
                </Text>
                <CheckStatusText check={website.checks.clock_in} timeZone={timeZone} />
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">
                  Time out
                </Text>
                <CheckStatusText check={website.checks.clock_out} timeZone={timeZone} />
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">
                  Pages and buttons
                </Text>
                <ManualResultText result={website.shift.pagesButtons} />
              </Stack>
            </Group>
          </Card>
        ))}
      </Stack>
    )
  }

  return (
    <Table highlightOnHover verticalSpacing="sm" stickyHeader>
      <Table.Thead>
        <Table.Tr>
          <Table.Th scope="col">Website</Table.Th>
          <Table.Th scope="col">Time in</Table.Th>
          <Table.Th scope="col">Time out</Table.Th>
          <Table.Th scope="col">Pages and buttons</Table.Th>
          <Table.Th scope="col">Form email</Table.Th>
          <Table.Th scope="col">
            <VisuallyHidden>Findings</VisuallyHidden>
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {websites.map((website) => (
          <Table.Tr
            key={website.id}
            // The name is the keyboard path; the whole row is a larger target for the mouse.
            onClick={() => onOpen(website.id)}
            style={{ cursor: 'pointer' }}
          >
            <Table.Th scope="row" fw={400} maw={260}>
              <OpenButton website={website} onOpen={onOpen} />
            </Table.Th>
            <Table.Td>
              <CheckStatusText check={website.checks.clock_in} timeZone={timeZone} />
            </Table.Td>
            <Table.Td>
              <CheckStatusText check={website.checks.clock_out} timeZone={timeZone} />
            </Table.Td>
            <Table.Td>
              <ManualResultText result={website.shift.pagesButtons} />
            </Table.Td>
            <Table.Td>
              <FormEmailText website={website} />
              {website.formEmail ? (
                <Text size="xs" c="dimmed">
                  {formatDate(website.formEmail.testedAt, timeZone)}
                </Text>
              ) : null}
            </Table.Td>
            <Table.Td w={40}>
              {hasFindings(website) ? (
                <>
                  <IconNote size={18} aria-hidden />
                  <VisuallyHidden>Has findings</VisuallyHidden>
                </>
              ) : null}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

'use client'

import { Alert, Button, Card, Group, Modal, Skeleton, Stack, Text } from '@mantine/core'
import { IconPlus, IconWorldCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { useUrlQueryParam } from '@/lib/use-url-query-param'
import { offerUndo } from '@/lib/undo'
import { useChecklist, useRecordCheck, useRunRound } from '../hooks/use-checklist'
import {
  useArchiveWebsite,
  useClientOptions,
  useCreateWebsite,
  useRestoreWebsite,
  useUpdateWebsite,
} from '../hooks/use-websites'
import {
  CHECK_ROUNDS,
  CHECK_ROUND_LABELS,
  EMPTY_WEBSITE_DRAFT,
  type CheckRound,
  type WebsiteRow,
} from '../schema'
import { CheckVerdictForm } from './check-verdict-form'
import { DayNav } from './day-nav'
import { RoundSummary } from './round-summary'
import { WebsiteCard } from './website-card'
import { WebsiteForm } from './website-form'

export interface ChecklistPanelProps {
  canCheck: boolean
  canManage: boolean
  userName: string
}

type Editing = { kind: 'new' } | { kind: 'edit'; website: WebsiteRow }

export function ChecklistPanel({ canCheck, canManage, userName }: ChecklistPanelProps) {
  // Days are URL state, so a link to "what was down on the 3rd" stands on its own.
  const day = useUrlQueryParam('date', 0)
  const checklist = useChecklist(day.value)
  const list = checklist.data
  const isToday = Boolean(list && list.date === list.today)
  const canAct = canCheck && isToday

  const run = useRunRound(day.value)
  const record = useRecordCheck(day.value, userName)
  const clients = useClientOptions()
  const clientNameOf = (clientId: string) =>
    clients.data?.find((client) => client.id === clientId)?.name ?? ''
  const create = useCreateWebsite(clientNameOf)
  const update = useUpdateWebsite(clientNameOf)
  const archive = useArchiveWebsite()
  const restore = useRestoreWebsite()

  // Only which dialog is open lives here; every field inside is react-hook-form's.
  const [verdictFor, setVerdictFor] = useState<{ website: WebsiteRow; round: CheckRound }>()
  const [editing, setEditing] = useState<Editing>()

  function removeWebsite(website: WebsiteRow) {
    archive.mutate({ id: website.id })
    offerUndo({
      message: `Removed ${website.name} from the list.`,
      undoLabel: 'Undo',
      onUndo: () => restore.mutate({ id: website.id }),
      onCommit: () => undefined,
    })
  }

  if (checklist.isPending) {
    return (
      <Stack gap="md" aria-busy="true" aria-label="Loading the checklist">
        <Skeleton height={36} width="22rem" />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={150} radius="md" />
        ))}
      </Stack>
    )
  }

  if (checklist.isError || !list) {
    return (
      <Alert role="alert" color="red" variant="light" title="Could not load the checklist">
        <Stack gap="xs" align="flex-start">
          <Text size="sm">
            {checklist.error?.message ?? 'Something went wrong.'} Check your connection and try
            again.
          </Text>
          <Button size="xs" variant="default" onClick={() => checklist.refetch()}>
            Try again
          </Button>
        </Stack>
      </Alert>
    )
  }

  const runningRound = run.isPending && !run.variables?.websiteId ? run.variables?.round : undefined

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <DayNav
          date={list.date}
          today={list.today}
          // Today is the empty value, so every edit lands on the one cache key for today.
          onChange={(next) => day.commit(next === list.today ? '' : next)}
        />
        {canManage && isToday ? (
          <Button
            variant="default"
            leftSection={<IconPlus size={18} aria-hidden />}
            onClick={() => setEditing({ kind: 'new' })}
          >
            Add website
          </Button>
        ) : null}
      </Group>

      {list.websites.length > 0 ? (
        <Card withBorder padding="md">
          <Stack gap="sm">
            {CHECK_ROUNDS.map((round) => (
              <Group key={round} justify="space-between" wrap="wrap" gap="sm">
                <RoundSummary round={round} websites={list.websites} />
                {canAct ? (
                  <Button
                    leftSection={<IconWorldCheck size={18} aria-hidden />}
                    variant={round === 'clock_in' ? 'filled' : 'light'}
                    loading={runningRound === round}
                    disabled={run.isPending && runningRound !== round}
                    onClick={() => run.mutate({ round })}
                  >
                    {runningRound === round
                      ? 'Checking every site…'
                      : `Run ${CHECK_ROUND_LABELS[round].toLowerCase()} check`}
                  </Button>
                ) : null}
              </Group>
            ))}
            {canCheck && !isToday ? (
              <Text size="sm" c="dimmed">
                Past days are a record and stay as they were left. Go to today to check.
              </Text>
            ) : null}
            {!canCheck ? (
              <Text size="sm" c="dimmed">
                The IT lead runs these checks when they clock in and again when they clock out.
              </Text>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {list.websites.length === 0 ? (
        <Card withBorder>
          <EmptyState
            title={isToday ? 'No websites yet' : 'No websites on this day'}
            description={
              isToday
                ? 'Add each client website so the IT lead can check it at time in and time out.'
                : 'Nothing was on the list on this day.'
            }
            action={
              canManage && isToday ? (
                <Button onClick={() => setEditing({ kind: 'new' })}>Add website</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Stack component="ul" gap="sm" p={0} m={0} style={{ listStyle: 'none' }}>
          {list.websites.map((website) => (
            <WebsiteCard
              key={website.id}
              website={website}
              timeZone={list.timeZone}
              canCheck={canAct}
              canManage={canManage && isToday}
              checkingRound={
                runningRound ??
                (run.isPending && run.variables?.websiteId === website.id
                  ? run.variables.round
                  : undefined)
              }
              onRecheck={(round) => run.mutate({ round, websiteId: website.id })}
              onVerdict={(round) => setVerdictFor({ website, round })}
              onEdit={() => setEditing({ kind: 'edit', website })}
              onArchive={() => removeWebsite(website)}
            />
          ))}
        </Stack>
      )}

      <Modal
        opened={Boolean(verdictFor)}
        onClose={() => setVerdictFor(undefined)}
        title={
          verdictFor
            ? `${verdictFor.website.name} · ${CHECK_ROUND_LABELS[verdictFor.round]}`
            : 'Mark check'
        }
        centered
      >
        {verdictFor ? (
          <CheckVerdictForm
            defaults={{
              status: verdictFor.website.checks[verdictFor.round]?.status ?? 'up',
              note: verdictFor.website.checks[verdictFor.round]?.note ?? '',
            }}
            // Not awaited: the card already shows the verdict, and a failure is announced and rolled back.
            onSave={async (values) => {
              record.mutate({
                websiteId: verdictFor.website.id,
                round: verdictFor.round,
                status: values.status,
                note: values.note,
              })
            }}
            onClose={() => setVerdictFor(undefined)}
          />
        ) : null}
      </Modal>

      <Modal
        opened={Boolean(editing)}
        onClose={() => setEditing(undefined)}
        title={editing?.kind === 'edit' ? 'Edit website' : 'Add website'}
        centered
        size="lg"
      >
        {editing ? (
          <WebsiteForm
            defaults={
              editing.kind === 'edit'
                ? {
                    name: editing.website.name,
                    url: editing.website.url,
                    clientId: editing.website.clientId,
                    notes: editing.website.notes,
                  }
                : EMPTY_WEBSITE_DRAFT
            }
            clients={clients.data ?? []}
            clientsLoading={clients.isPending}
            submitLabel={editing.kind === 'edit' ? 'Save changes' : 'Add website'}
            onSave={async (values) => {
              if (editing.kind === 'edit') {
                await update.mutateAsync({ ...values, id: editing.website.id })
              } else {
                await create.mutateAsync({ ...values, tempId: crypto.randomUUID() })
              }
            }}
            onClose={() => setEditing(undefined)}
          />
        ) : null}
      </Modal>
    </Stack>
  )
}

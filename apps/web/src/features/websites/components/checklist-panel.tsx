'use client'

import { Alert, Button, Card, Drawer, Group, Modal, Skeleton, Stack, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconFileTypePdf, IconPlus, IconWorldCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { useUrlQueryParam } from '@/lib/use-url-query-param'
import { offerUndo } from '@/lib/undo'
import { track } from '@/lib/analytics'
import {
  useChecklist,
  useExpiry,
  useExportDayReport,
  useRecordCheck,
  useRunRound,
  useSaveShiftCheck,
} from '../hooks/use-checklist'
import { websiteEvents } from '../events'
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
import { awaitsSnapshots } from '../utils/snapshot-state'
import { CheckVerdictForm } from './check-verdict-form'
import { DayNav } from './day-nav'
import { RoundSummary } from './round-summary'
import { WebsitePanel } from './website-panel'
import { WebsiteTable } from './website-table'
import { WebsiteForm } from './website-form'

export interface ChecklistPanelProps {
  canCheck: boolean
  canManage: boolean
  userName: string
}

type Editing = { kind: 'new' } | { kind: 'edit'; website: WebsiteRow }

// Pictures land a few seconds after a round, so the list looks again until each one is in.
const SNAPSHOT_POLL_MS = 4000

export function ChecklistPanel({ canCheck, canManage, userName }: ChecklistPanelProps) {
  // Days are URL state, so a link to "what was down on the 3rd" stands on its own.
  const day = useUrlQueryParam('date', 0)
  const checklist = useChecklist(day.value, (current) =>
    current && awaitsSnapshots(current, Date.now()) ? SNAPSHOT_POLL_MS : false,
  )
  const list = checklist.data
  const isToday = Boolean(list && list.date === list.today)
  // Every poll refreshes this, so a picture still on its way is judged against a current time.
  const listedAt = checklist.dataUpdatedAt
  const canAct = canCheck && isToday

  const run = useRunRound(day.value)
  const record = useRecordCheck(day.value, userName)
  const saveShift = useSaveShiftCheck(day.value)
  const report = useExportDayReport()
  // The open site is URL state, so a link to it opens the panel and Back is never lost.
  const site = useUrlQueryParam('site', 0)
  const narrow = useMediaQuery('(max-width: 48em)') ?? false
  const opened = list?.websites.find((website) => website.id === site.value)
  const expiry = useExpiry(opened?.id)
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

  function openSite(websiteId: string) {
    site.commit(websiteId)
    track(websiteEvents.panelOpened)
  }

  function removeWebsite(website: WebsiteRow) {
    site.commit('')
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
        <Skeleton height={96} radius="md" />
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} height={52} radius="sm" />
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
        <Group gap="sm" wrap="wrap">
          {list.websites.length > 0 ? (
            <Button
              variant="default"
              leftSection={<IconFileTypePdf size={18} aria-hidden />}
              loading={report.isPending}
              onClick={() => report.mutate(list.date)}
            >
              Download PDF report
            </Button>
          ) : null}
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
            {!isToday && list.snapshotsEnabled ? (
              <Text size="sm" c="dimmed">
                Snapshots are kept for the day they are taken, so past days show none.
              </Text>
            ) : null}
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
        <WebsiteTable
          websites={list.websites}
          timeZone={list.timeZone}
          narrow={narrow}
          onOpen={openSite}
        />
      )}

      <Drawer
        opened={Boolean(opened)}
        onClose={() => site.commit('')}
        position="right"
        size={narrow ? '100%' : 'lg'}
        title={opened?.name ?? 'Website'}
      >
        {opened ? (
          <WebsitePanel
            key={opened.id}
            website={opened}
            timeZone={list.timeZone}
            showSnapshots={isToday && list.snapshotsEnabled}
            now={listedAt}
            canAct={canAct}
            canManage={canManage && isToday}
            checkingRound={
              runningRound ??
              (run.isPending && run.variables?.websiteId === opened.id
                ? run.variables.round
                : undefined)
            }
            expiry={expiry.data}
            expiryPending={expiry.isPending}
            onRecheck={(round) => run.mutate({ round, websiteId: opened.id })}
            onOverride={(round) => setVerdictFor({ website: opened, round })}
            onPagesButtons={(result) =>
              saveShift.mutate({ websiteId: opened.id, pagesButtons: result })
            }
            onFormEmail={(result) => saveShift.mutate({ websiteId: opened.id, formEmail: result })}
            onSaveFindings={async (values) => {
              await saveShift.mutateAsync({ websiteId: opened.id, ...values })
            }}
            onEdit={() => setEditing({ kind: 'edit', website: opened })}
            onArchive={() => removeWebsite(opened)}
          />
        ) : null}
      </Drawer>

      <Modal
        opened={Boolean(verdictFor)}
        onClose={() => setVerdictFor(undefined)}
        title={
          verdictFor
            ? `${verdictFor.website.name} · ${CHECK_ROUND_LABELS[verdictFor.round]}`
            : 'Change status'
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

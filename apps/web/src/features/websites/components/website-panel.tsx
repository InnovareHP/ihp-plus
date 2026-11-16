'use client'

import {
  Anchor,
  Button,
  Collapse,
  Divider,
  Group,
  Menu,
  Stack,
  Text,
  VisuallyHidden,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { ReactNode } from 'react'
import { IconArchive, IconChevronDown, IconExternalLink, IconPencil } from '@tabler/icons-react'
import { RowActionsMenu } from '@/components/row-actions-menu'
import {
  CHECK_ROUNDS,
  CHECK_ROUND_LABELS,
  MANUAL_RESULT_LABELS,
  type CheckRound,
  type FindingsFormInput,
  type ManualResult,
  type WebsiteRow,
} from '../schema'
import { formatDate } from '../utils/day-report'
import { ExpiryDates } from './expiry-dates'
import { FindingsForm } from './findings-form'
import { ManualCheckControl } from './manual-check-control'
import { PanelRound } from './panel-round'

export interface WebsitePanelProps {
  website: WebsiteRow
  timeZone: string
  showSnapshots: boolean
  now: number
  /** The IT lead, on today's list. */
  canAct: boolean
  canManage: boolean
  checkingRound: CheckRound | undefined
  expiry: { domain: string | undefined; ssl: string | undefined } | undefined
  expiryPending: boolean
  onRecheck: (round: CheckRound) => void
  onOverride: (round: CheckRound) => void
  onPagesButtons: (result: ManualResult) => void
  onFormEmail: (result: ManualResult) => void
  onSaveFindings: (values: FindingsFormInput) => Promise<void>
  onEdit: () => void
  onArchive: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs" component="section" aria-label={title}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

/** Everything about one site on one shift: what the checker saw and what the lead did. */
export function WebsitePanel({
  website,
  timeZone,
  showSnapshots,
  now,
  canAct,
  canManage,
  checkingRound,
  expiry,
  expiryPending,
  onRecheck,
  onOverride,
  onPagesButtons,
  onFormEmail,
  onSaveFindings,
  onEdit,
  onArchive,
}: WebsitePanelProps) {
  // Local disclosures only: which fold is open is not worth a URL.
  const [overrideOpen, override] = useDisclosure(false)
  const [retestOpen, retest] = useDisclosure(false)
  const showFormControls = canAct && (!website.formEmail || retestOpen)

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={2} miw={0}>
          <Anchor
            href={website.url}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            style={{ overflowWrap: 'anywhere' }}
          >
            {website.url} <IconExternalLink size={12} aria-hidden />
            <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
          </Anchor>
          {website.clientName ? (
            <Text size="xs" c="dimmed">
              Client: {website.clientName}
            </Text>
          ) : null}
        </Stack>
        {canManage ? (
          <RowActionsMenu name={website.name}>
            <Menu.Item leftSection={<IconPencil size={14} aria-hidden />} onClick={onEdit}>
              Edit website
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconArchive size={14} aria-hidden />}
              onClick={onArchive}
            >
              Remove from list
            </Menu.Item>
          </RowActionsMenu>
        ) : null}
      </Group>

      <Section title="Automatic checks">
        {CHECK_ROUNDS.map((round) => (
          <PanelRound
            key={round}
            round={round}
            check={website.checks[round]}
            websiteId={website.id}
            websiteName={website.name}
            timeZone={timeZone}
            snapshotAt={website.snapshots[round]}
            showSnapshots={showSnapshots}
            now={now}
            canAct={canAct}
            isChecking={checkingRound === round}
            onRecheck={() => onRecheck(round)}
          />
        ))}
        {canAct ? (
          <>
            <Button
              variant="subtle"
              size="compact-sm"
              color="gray"
              rightSection={<IconChevronDown size={14} aria-hidden />}
              aria-expanded={overrideOpen}
              aria-controls="override-status"
              onClick={override.toggle}
              style={{ alignSelf: 'flex-start' }}
            >
              Checker is wrong? Change status
            </Button>
            <Collapse expanded={overrideOpen} id="override-status">
              <Group gap="xs" wrap="wrap">
                {CHECK_ROUNDS.map((round) => (
                  <Button key={round} variant="default" onClick={() => onOverride(round)}>
                    Change {CHECK_ROUND_LABELS[round].toLowerCase()} status
                  </Button>
                ))}
              </Group>
            </Collapse>
          </>
        ) : null}
      </Section>

      <Divider />

      <Section title="Your checks">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm" fw={600}>
            Pages and buttons
          </Text>
          {canAct ? (
            <ManualCheckControl
              label={`Pages and buttons for ${website.name}`}
              value={website.shift.pagesButtons}
              onPick={onPagesButtons}
            />
          ) : (
            <Text size="sm">
              {website.shift.pagesButtons
                ? MANUAL_RESULT_LABELS[website.shift.pagesButtons]
                : 'Not checked'}
            </Text>
          )}
        </Group>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              Form email
            </Text>
            <Text size="xs" c="dimmed">
              {website.formEmail
                ? `${MANUAL_RESULT_LABELS[website.formEmail.result]} · tested ${formatDate(website.formEmail.testedAt, timeZone)}`
                : 'Tested once per site'}
            </Text>
          </Stack>
          {showFormControls ? (
            <ManualCheckControl
              label={`Form email for ${website.name}`}
              value={retestOpen ? undefined : website.formEmail?.result}
              onPick={(result) => {
                onFormEmail(result)
                retest.close()
              }}
            />
          ) : canAct ? (
            <Button variant="default" onClick={retest.open}>
              Test again
            </Button>
          ) : null}
        </Group>
        {website.shift.pagesButtons === 'fail' && !website.shift.findings ? (
          <Text size="sm" c="red">
            Say what failed under What you found.
          </Text>
        ) : null}
        <FindingsForm
          defaults={{ findings: website.shift.findings, action: website.shift.action }}
          readOnly={!canAct}
          onSave={onSaveFindings}
        />
      </Section>

      <Divider />

      <Section title="Domain and SSL">
        <ExpiryDates
          domain={expiry?.domain}
          ssl={expiry?.ssl}
          isPending={expiryPending}
          timeZone={timeZone}
          now={new Date(now)}
        />
      </Section>
    </Stack>
  )
}

'use client'

import { Alert, Button, Card, Grid, Group, Stack, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { EmptyState } from '@/components/empty-state'
import { useUrlQueryParam } from '@/lib/use-url-query-param'
import {
  useApproveDigestIssue,
  useDeleteDigestIssue,
  useDigestOverview,
  useGenerateDigestDraft,
  useRejectDigestIssue,
  useReopenDigestIssue,
  useSaveDigestSettings,
  useSendDigestNow,
  useSendDigestTest,
} from '../use-security-digest'
import { DeleteIssueDialog } from './delete-issue-dialog'
import { DigestSettingsForm } from './digest-settings-form'
import { IssueList } from './issue-list'
import { IssuePreview } from './issue-preview'
import { SecurityDigestSkeleton } from './security-digest-skeleton'
import { SendNowDialog } from './send-now-dialog'

/** IT's monitoring view: what is queued, what went out, who got it, and the switch for all of it. */
export function SecurityDigestWorkspace() {
  const overview = useDigestOverview()
  const selected = useUrlQueryParam('issue', 0)
  const saveSettings = useSaveDigestSettings()
  const generate = useGenerateDigestDraft()
  const approve = useApproveDigestIssue()
  const reject = useRejectDigestIssue()
  const reopen = useReopenDigestIssue()
  const remove = useDeleteDigestIssue()
  const sendNow = useSendDigestNow()
  const sendTest = useSendDigestTest()
  const [confirming, confirm] = useDisclosure(false)
  const [deleting, confirmDelete] = useDisclosure(false)

  if (overview.isPending) return <SecurityDigestSkeleton />
  if (overview.isError) {
    return (
      <Alert role="alert" color="red" variant="light" title="Could not load the security emails">
        <Stack gap="xs" align="flex-start">
          {overview.error.message}
          <Button variant="default" size="sm" onClick={() => overview.refetch()}>
            Try again
          </Button>
        </Stack>
      </Alert>
    )
  }

  const data = overview.data
  // A stale or foreign id in the URL falls back to the newest issue rather than a blank panel.
  const issue = data.issues.find((row) => row.id === selected.value) ?? data.issues[0]
  const issueId = { issueId: issue?.id ?? '' }

  return (
    <Stack gap="lg">
      {!data.aiConfigured ? (
        <Alert color="yellow" variant="light" title="The AI is not set up">
          Drafts need BEDROCK_MODEL_ID on the server; until then each week records a failed draft.
        </Alert>
      ) : null}
      {!data.emailConfigured ? (
        <Alert color="yellow" variant="light" title="Email is not set up">
          Without EMAIL_FROM, sends are only written to the server log and show as “Logged only”.
        </Alert>
      ) : null}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={2}>Issues</Title>
              {data.canManage ? (
                <Button
                  variant="default"
                  onClick={() => generate.mutate()}
                  loading={generate.isPending}
                >
                  Draft new issue
                </Button>
              ) : null}
            </Group>
            {data.issues.length === 0 ? (
              <Card withBorder>
                <EmptyState
                  title="No issues yet"
                  description="Draft the first issue to see what staff will receive, then approve it to send on Monday."
                  action={
                    data.canManage ? (
                      <Button onClick={() => generate.mutate()} loading={generate.isPending}>
                        Draft first issue
                      </Button>
                    ) : null
                  }
                />
              </Card>
            ) : (
              <IssueList
                issues={data.issues}
                selectedId={issue?.id ?? ''}
                onSelect={selected.commit}
              />
            )}
            <Card withBorder padding="lg">
              <Stack gap="md">
                <Title order={2}>Settings</Title>
                <DigestSettingsForm
                  settings={data.settings}
                  clientContacts={data.clientContacts}
                  canManage={data.canManage}
                  onSave={(values) => saveSettings.mutateAsync(values)}
                />
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          {issue ? (
            <IssuePreview
              issue={issue}
              canManage={data.canManage}
              pending={{
                approve: approve.isPending,
                reject: reject.isPending,
                reopen: reopen.isPending,
                send: sendNow.isPending,
                test: sendTest.isPending,
              }}
              onApprove={() => approve.mutate(issueId)}
              onReject={() => reject.mutate(issueId)}
              onReopen={() => reopen.mutate(issueId)}
              onDelete={confirmDelete.open}
              onSendNow={confirm.open}
              onSendTest={() => sendTest.mutate(issueId)}
            />
          ) : null}
          {issue ? (
            <SendNowDialog
              opened={confirming}
              title={issue.title}
              recipientCount={data.recipientCount}
              isDraft={issue.status === 'draft'}
              pending={sendNow.isPending}
              onClose={confirm.close}
              onConfirm={() => sendNow.mutate(issueId, { onSettled: confirm.close })}
            />
          ) : null}
          {issue ? (
            <DeleteIssueDialog
              opened={deleting}
              title={issue.title}
              pending={remove.isPending}
              onClose={confirmDelete.close}
              onConfirm={() => {
                // The row leaves the list at once, so the dialog closes with it.
                remove.mutate(issueId)
                confirmDelete.close()
              }}
            />
          ) : null}
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

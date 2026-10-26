'use client'

import { Alert, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconArrowBackUp } from '@tabler/icons-react'
import type { DraftDetail } from '../schema'
import { useDraft, useUndoDraftChange } from '../use-drafts'
import { missingFields } from '../utils/document'
import { DownloadDraftButton } from './download-draft-button'
import { DraftChat } from './draft-chat'
import { DraftPreview } from './draft-preview'

export interface DraftWorkspaceProps {
  initialDraft: DraftDetail
}

export function DraftWorkspace({ initialDraft }: DraftWorkspaceProps) {
  const { data: draft } = useDraft(initialDraft.id, initialDraft)
  const undo = useUndoDraftChange(draft.id)
  const missing = missingFields(draft.body)

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <DraftChat draftId={draft.id} messages={draft.messages} />

      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Text fw={600}>{draft.title}</Text>
          <Group gap="sm">
            <Button
              variant="default"
              leftSection={<IconArrowBackUp size={16} aria-hidden />}
              disabled={!draft.canUndo}
              loading={undo.isPending}
              onClick={() => undo.mutate()}
            >
              Undo last change
            </Button>
            <DownloadDraftButton
              title={draft.title}
              body={draft.body}
              missingCount={missing.length}
            />
          </Group>
        </Group>

        {missing.length > 0 ? (
          <Alert
            role="status"
            color="yellow"
            variant="light"
            title={`${missing.length} ${missing.length === 1 ? 'detail' : 'details'} still missing`}
          >
            <Text size="sm">
              Highlighted in the document: {missing.join(', ').replaceAll('_', ' ')}. Tell the
              assistant these before sending the PDF.
            </Text>
          </Alert>
        ) : null}

        <Paper
          component="section"
          withBorder
          radius="md"
          p={{ base: 'md', sm: 'xl' }}
          aria-label="Document preview"
        >
          <DraftPreview body={draft.body} />
        </Paper>
      </Stack>
    </SimpleGrid>
  )
}

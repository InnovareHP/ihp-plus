import { Badge, Group, List, Mark, Paper, Stack, Text, Title } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { parseDocument, type Block } from '../utils/document'

export interface DraftPreviewProps {
  body: string
}

// Placeholders stay visible as text, so the highlight is never the only cue.
function withFields(text: string): ReactNode[] {
  return text.split(/(\{\{\s*[a-z0-9_]+\s*\}\})/gi).map((part, index) =>
    index % 2 === 1 ? (
      <Mark key={index} color="yellow">
        {part}
      </Mark>
    ) : (
      part
    ),
  )
}

function renderBlocks(blocks: readonly Block[]) {
  const out: ReactNode[] = []
  let bullets: Block[] = []

  const flushBullets = () => {
    if (bullets.length === 0) return
    out.push(
      <List key={`list-${out.length}`} size="sm" spacing={4}>
        {bullets.map((bullet, index) => (
          <List.Item key={index}>{withFields(bullet.text)}</List.Item>
        ))}
      </List>,
    )
    bullets = []
  }

  for (const block of blocks) {
    if (block.kind === 'bullet') {
      bullets.push(block)
      continue
    }
    flushBullets()
    const key = out.length
    if (block.kind === 'title') {
      out.push(
        <Title key={key} order={2} size="h3" c="brand">
          {withFields(block.text)}
        </Title>,
      )
    } else if (block.kind === 'heading') {
      out.push(
        <Title key={key} order={3} size="h4">
          {withFields(block.text)}
        </Title>,
      )
    } else {
      out.push(
        <Text key={key} size="sm">
          {withFields(block.text)}
        </Text>,
      )
    }
  }
  flushBullets()
  return out
}

/** Locked runs are grouped so the fixed legal wording reads as one marked-off section. */
function groups(blocks: readonly Block[]) {
  const runs: { locked: boolean; blocks: Block[] }[] = []
  for (const block of blocks) {
    const last = runs.at(-1)
    if (last && last.locked === block.locked) last.blocks.push(block)
    else runs.push({ locked: block.locked, blocks: [block] })
  }
  return runs
}

export function DraftPreview({ body }: DraftPreviewProps) {
  return (
    <Stack gap="sm">
      {groups(parseDocument(body)).map((run, index) =>
        run.locked ? (
          <Paper key={index} withBorder radius="sm" p="sm" bg="var(--mantine-color-default-hover)">
            <Group gap={6} mb="xs">
              <IconLock size={14} aria-hidden />
              <Badge size="xs" variant="light" color="gray">
                Locked wording
              </Badge>
            </Group>
            <Stack gap="sm">{renderBlocks(run.blocks)}</Stack>
          </Paper>
        ) : (
          <Stack key={index} gap="sm">
            {renderBlocks(run.blocks)}
          </Stack>
        ),
      )}
    </Stack>
  )
}

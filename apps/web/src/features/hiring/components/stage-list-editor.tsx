'use client'

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  List,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconMail, IconPlus, IconTrash } from '@tabler/icons-react'
import { ENTRY_STAGE_ID, MAX_STAGES, type StageInput } from '../schema'

export interface StageErrors {
  name?: string
  message?: string
}

export interface StageListEditorProps {
  stages: readonly StageInput[]
  onChange: (stages: StageInput[]) => void
  /** Per-stage errors, index for index, plus one for the list as a whole. */
  errors?: readonly (StageErrors | undefined)[]
  listError?: string
  /** Active applicants per stage id; a stage somebody is in cannot be removed. */
  counts?: Record<string, number>
}

function newStage(): StageInput {
  return { id: `stage-${crypto.randomUUID().slice(0, 8)}`, name: '', message: '' }
}

// Controlled rather than a field array of its own, so the posting and the settings form share it.
export function StageListEditor({
  stages,
  onChange,
  errors = [],
  listError,
  counts = {},
}: StageListEditorProps) {
  function patch(index: number, change: Partial<StageInput>) {
    onChange(stages.map((stage, at) => (at === index ? { ...stage, ...change } : stage)))
  }

  function move(index: number, by: -1 | 1) {
    const next = [...stages]
    const target = index + by
    const moving = next[index]
    const other = next[target]
    if (!moving || !other) return
    next[index] = other
    next[target] = moving
    onChange(next)
  }

  return (
    <Stack gap="sm">
      {listError ? (
        <Text size="sm" c="red" role="alert">
          {listError}
        </Text>
      ) : null}

      {/* An ordered list, so a screen reader hears the order the pipeline runs in. */}
      <List type="ordered" listStyleType="none" spacing="sm" withPadding={false}>
        {stages.map((stage, index) => {
          const isEntry = stage.id === ENTRY_STAGE_ID
          const inStage = counts[stage.id] ?? 0
          const label = stage.name.trim() || `stage ${index + 1}`

          return (
            <List.Item key={stage.id}>
              <Card withBorder padding="md">
                <Stack gap="sm">
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap="xs" wrap="wrap">
                      <Text fw={600} size="sm">
                        Stage {index + 1}
                      </Text>
                      {isEntry ? (
                        <Badge variant="light" size="sm">
                          New applications land here
                        </Badge>
                      ) : null}
                      {stage.message?.trim() ? (
                        <Badge
                          variant="light"
                          color="teal"
                          size="sm"
                          leftSection={<IconMail size={12} aria-hidden />}
                        >
                          Emails the applicant
                        </Badge>
                      ) : null}
                      {inStage > 0 ? (
                        <Badge variant="outline" color="gray" size="sm">
                          {inStage} here now
                        </Badge>
                      ) : null}
                    </Group>
                    {isEntry ? null : (
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="lg"
                          aria-label={`Move ${label} up`}
                          // Nothing moves above the entry stage.
                          disabled={index <= 1}
                          onClick={() => move(index, -1)}
                        >
                          <IconArrowUp size={16} aria-hidden />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="lg"
                          aria-label={`Move ${label} down`}
                          disabled={index === stages.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <IconArrowDown size={16} aria-hidden />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="lg"
                          aria-label={
                            inStage > 0 ? `${label} has applicants, so it stays` : `Remove ${label}`
                          }
                          disabled={inStage > 0}
                          onClick={() => onChange(stages.filter((_, at) => at !== index))}
                        >
                          <IconTrash size={16} aria-hidden />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>

                  <TextInput
                    label="Stage name"
                    placeholder="Phone screen"
                    required
                    aria-required="true"
                    value={stage.name}
                    onChange={(event) => patch(index, { name: event.currentTarget.value })}
                    error={errors[index]?.name}
                    errorProps={{ role: 'alert' }}
                  />
                  <Textarea
                    label="Email to the applicant"
                    description="Sent when someone is moved into this stage. Leave it empty to move people quietly."
                    autosize
                    minRows={2}
                    value={stage.message ?? ''}
                    onChange={(event) => patch(index, { message: event.currentTarget.value })}
                    error={errors[index]?.message}
                    errorProps={{ role: 'alert' }}
                  />
                </Stack>
              </Card>
            </List.Item>
          )
        })}
      </List>

      <Group>
        <Button
          variant="default"
          leftSection={<IconPlus size={16} aria-hidden />}
          disabled={stages.length >= MAX_STAGES}
          onClick={() => onChange([...stages, newStage()])}
        >
          Add stage
        </Button>
        {stages.length >= MAX_STAGES ? (
          <Text size="sm" c="dimmed">
            That is the most a posting can have.
          </Text>
        ) : null}
      </Group>
    </Stack>
  )
}

'use client'

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  LOOKUP_KIND_LABELS,
  parseOptionList,
  type LookupKind,
  type LookupOptionLists,
} from '@/features/lookups/schema'
import {
  useAddLookupOptions,
  useRetireLookupOption,
} from '@/features/lookups/hooks/use-lookup-admin'

export interface LookupOptionsModalProps {
  opened: boolean
  onClose: () => void
  /** The lists this screen owns, so the Clients modal never offers the onboarding lists. */
  kinds: readonly LookupKind[]
  lists: LookupOptionLists
  /** Which list to open on, so "Manage options" beside a field lands on that field. */
  initialKind: LookupKind
}

/**
 * One place to curate a dropdown: see what a list holds, retire a value, and paste a whole
 * column in at once. Every screen with curated dropdowns opens this rather than growing its own.
 */
export function LookupOptionsModal({
  opened,
  onClose,
  kinds,
  lists,
  initialKind,
}: LookupOptionsModalProps) {
  const [kind, setKind] = useState<LookupKind>(initialKind)
  const add = useAddLookupOptions()
  const retire = useRetireLookupOption()
  const { register, watch, reset } = useForm<{ pasted: string }>({
    defaultValues: { pasted: '' },
  })

  const kindOptions = kinds.map((option) => ({
    value: option,
    label: LOOKUP_KIND_LABELS[option],
  }))
  const active = kinds.includes(kind) ? kind : initialKind
  const pasted = watch('pasted')
  const parsed = parseOptionList(pasted)
  const existing = lists[active] ?? []
  const known = new Set(existing.map((value) => value.toLowerCase()))
  const fresh = parsed.filter((value) => !known.has(value.toLowerCase()))

  function onAdd() {
    if (fresh.length === 0) return
    // mutate, not mutateAsync: the failure path is already announced by the hook.
    add.mutate({ kind: active, values: parsed }, { onSuccess: () => reset({ pasted: '' }) })
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Manage dropdown options"
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': 'Close dropdown options' }}
    >
      <Stack gap="md">
        <Select
          label="List"
          description="Each list is its own dropdown, and every form that reads it updates at once."
          data={kindOptions}
          value={active}
          allowDeselect={false}
          onChange={(value) => {
            if (!value) return
            setKind(value as LookupKind)
            add.reset()
          }}
        />

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {LOOKUP_KIND_LABELS[active]} ({existing.length})
          </Text>
          {existing.length === 0 ? (
            <Text size="sm" c="dimmed">
              No values yet — paste a list below to fill this dropdown.
            </Text>
          ) : (
            <ScrollArea.Autosize mah={160}>
              <Group gap="xs">
                {existing.map((value) => (
                  <Badge
                    key={value}
                    variant="light"
                    size="lg"
                    rightSection={
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        color="gray"
                        aria-label={`Retire ${value}`}
                        onClick={() => retire.mutate({ kind: active, value })}
                      >
                        <IconX size={12} aria-hidden />
                      </ActionIcon>
                    }
                  >
                    {value}
                  </Badge>
                ))}
              </Group>
            </ScrollArea.Autosize>
          )}
        </Stack>

        <Textarea
          {...register('pasted')}
          label={`Add ${LOOKUP_KIND_LABELS[active].toLowerCase()} in bulk`}
          description="One per line, or separated by commas, semicolons or tabs — a spreadsheet column pastes straight in."
          placeholder={'Policy\nProcedure\nTraining'}
          autosize
          minRows={4}
          maxRows={10}
        />

        {parsed.length > 0 ? (
          <Text size="sm" c="dimmed" aria-live="polite">
            {fresh.length} to add
            {parsed.length - fresh.length > 0
              ? `, ${parsed.length - fresh.length} already in the list`
              : ''}
          </Text>
        ) : null}

        {add.isSuccess && add.data ? (
          <Alert color="green" variant="light" role="status">
            Added {add.data.added} value{add.data.added === 1 ? '' : 's'}
            {add.data.skipped > 0 ? `, skipped ${add.data.skipped} already in the list` : ''}.
          </Alert>
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Done
          </Button>
          <Button onClick={onAdd} disabled={fresh.length === 0} loading={add.isPending}>
            {add.isPending
              ? 'Adding…'
              : `Add ${fresh.length || ''} value${fresh.length === 1 ? '' : 's'}`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

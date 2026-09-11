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
import { LOOKUP_KIND_LABELS, parseOptionList } from '@/features/lookups/schema'
import { CLIENT_LOOKUP_KINDS, type ClientLookupKind, type ClientOptionMap } from '../schema'
import { useAddClientOptions, useArchiveClientOption } from '../use-client-options'

const KIND_OPTIONS = CLIENT_LOOKUP_KINDS.map((kind) => ({
  value: kind,
  label: LOOKUP_KIND_LABELS[kind],
}))

export interface ClientOptionsModalProps {
  opened: boolean
  onClose: () => void
  options: ClientOptionMap
  /** Which dropdown to open on, so "Manage options" beside a field lands on that field. */
  initialKind?: ClientLookupKind
}

export function ClientOptionsModal({
  opened,
  onClose,
  options,
  initialKind = 'clientType',
}: ClientOptionsModalProps) {
  const [kind, setKind] = useState<ClientLookupKind>(initialKind)
  const add = useAddClientOptions()
  const retire = useArchiveClientOption()
  const { register, watch, reset } = useForm<{ pasted: string }>({
    defaultValues: { pasted: '' },
  })

  const pasted = watch('pasted')
  const parsed = parseOptionList(pasted)
  const existing = options[kind] ?? []
  const known = new Set(existing.map((value) => value.toLowerCase()))
  const fresh = parsed.filter((value) => !known.has(value.toLowerCase()))

  function onAdd() {
    if (fresh.length === 0) return
    // mutate, not mutateAsync: the failure path is already announced by the hook.
    add.mutate({ kind, values: parsed }, { onSuccess: () => reset({ pasted: '' }) })
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
          label="Field"
          description="Each field keeps its own list, and every client form reads it."
          data={KIND_OPTIONS}
          value={kind}
          allowDeselect={false}
          onChange={(value) => {
            if (!value) return
            setKind(value as ClientLookupKind)
            add.reset()
          }}
        />

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {LOOKUP_KIND_LABELS[kind]} values ({existing.length})
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
                        onClick={() => retire.mutate({ kind, value })}
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
          label={`Add ${LOOKUP_KIND_LABELS[kind].toLowerCase()} in bulk`}
          description="One per line, or separated by commas, semicolons or tabs — a spreadsheet column pastes straight in."
          placeholder={'Hospital\nHospice\nPhysician group'}
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

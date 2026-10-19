'use client'

import { Button, CloseButton, Group, Text } from '@mantine/core'
import { SCOPE_PREFIXES, type SearchScope } from '../utils/parse-query'

export interface ScopeChipsProps {
  scope: SearchScope | null
  /** Larger targets on a phone, where the symbols are awkward to type. */
  touch: boolean
  onPick: (symbol: string) => void
  onClear: () => void
}

/** Shows the prefixes as one-tap shortcuts, or which one is narrowing the search. */
export function ScopeChips({ scope, touch, onPick, onClear }: ScopeChipsProps) {
  const active = SCOPE_PREFIXES.find((one) => one.scope === scope)

  if (active) {
    return (
      <Group gap="xs" px="md" py={6} wrap="nowrap">
        <Text size="sm" c="dimmed">
          Searching {active.label.toLowerCase()} only
        </Text>
        <CloseButton size={touch ? 'xl' : 'sm'} aria-label="Search everything" onClick={onClear} />
      </Group>
    )
  }

  return (
    <Group gap={6} px="md" py={6} role="group" aria-label="Search one kind only">
      {SCOPE_PREFIXES.map((one) => (
        <Button
          key={one.symbol}
          variant="default"
          size={touch ? 'sm' : 'compact-xs'}
          mih={touch ? 44 : undefined}
          radius="xl"
          // The visible text leads, so a voice user can say what they see.
          aria-label={`${one.symbol} ${one.label}: search ${one.label.toLowerCase()} only`}
          onClick={() => onPick(one.symbol)}
        >
          {one.symbol} {one.label}
        </Button>
      ))}
    </Group>
  )
}

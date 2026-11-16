'use client'

import { Button, Group } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { MANUAL_RESULTS, MANUAL_RESULT_LABELS, type ManualResult } from '../schema'

const ICONS = { pass: IconCheck, fail: IconX } as const
const COLORS = { pass: 'teal', fail: 'red' } as const

export interface ManualCheckControlProps {
  /** Names the pair for a screen reader, e.g. "Pages and buttons for Riverside site". */
  label: string
  value: ManualResult | undefined
  onPick: (result: ManualResult) => void
}

// Two toggle buttons rather than radios, so arrowing past one never saves it.
export function ManualCheckControl({ label, value, onPick }: ManualCheckControlProps) {
  return (
    <Group role="group" aria-label={label} gap="xs" wrap="nowrap">
      {MANUAL_RESULTS.map((result) => {
        const Icon = ICONS[result]
        const picked = value === result
        return (
          <Button
            key={result}
            h={44}
            variant={picked ? 'light' : 'default'}
            color={picked ? COLORS[result] : undefined}
            leftSection={<Icon size={16} aria-hidden />}
            aria-pressed={picked}
            onClick={() => onPick(result)}
          >
            {MANUAL_RESULT_LABELS[result]}
          </Button>
        )
      })}
    </Group>
  )
}

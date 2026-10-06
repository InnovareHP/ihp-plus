'use client'

import { ActionIcon, Group, Table, Text, Tooltip } from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import type { FormAllowance, LeaveBalance, PersonBalances } from '../schema'
import { BalanceCell } from './balance-cell'

export interface TeamLeaveTableProps {
  forms: readonly FormAllowance[]
  people: readonly PersonBalances[]
  onEdit: (person: PersonBalances, balance: LeaveBalance, form: FormAllowance) => void
}

export function TeamLeaveTable({ forms, people, onEdit }: TeamLeaveTableProps) {
  return (
    <Table.ScrollContainer minWidth={320 + forms.length * 220}>
      <Table striped stickyHeader verticalSpacing="xs" aria-label="Leave balances by person">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Person</Table.Th>
            {forms.map((form) => (
              <Table.Th key={form.formId} scope="col">
                {form.formName}
                <Text span size="xs" c="dimmed" fw={400}>
                  {' '}
                  · {form.allowance} a year
                </Text>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {people.map((person) => (
            <Table.Tr key={person.userId}>
              <Table.Th scope="row">
                <Text size="sm" fw={500}>
                  {person.name}
                </Text>
              </Table.Th>
              {forms.map((form) => {
                const balance = person.balances.find((one) => one.formId === form.formId)
                if (!balance) return <Table.Td key={form.formId}>—</Table.Td>
                const label = `Change ${person.name}’s ${form.formName} allowance`
                return (
                  <Table.Td key={form.formId}>
                    <Group gap="xs" wrap="nowrap" justify="space-between">
                      <div>
                        <BalanceCell balance={balance} />
                        <Text size="xs" c="dimmed">
                          {balance.used} used
                          {balance.pending > 0 ? ` · ${balance.pending} pending` : ''}
                        </Text>
                      </div>
                      <Tooltip label={label}>
                        <ActionIcon
                          variant="subtle"
                          size="lg"
                          aria-label={label}
                          onClick={() => onEdit(person, balance, form)}
                        >
                          <IconPencil size={18} aria-hidden="true" />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                )
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

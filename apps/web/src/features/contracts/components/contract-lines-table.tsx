import { Group, Stack, Table, Text } from '@mantine/core'
import { CATALOG_UNIT_LABELS, formatCents, lineTotalCents, type ContractLineRow } from '../schema'

export interface ContractLinesTableProps {
  lines: readonly Pick<ContractLineRow, 'id' | 'name' | 'unitPriceCents' | 'quantity' | 'unit'>[]
  subtotalCents: number
}

export function ContractLinesTable({ lines, subtotalCents }: ContractLinesTableProps) {
  return (
    <Stack gap="xs">
      {/* Scrolls inside its own box, so a narrow screen never scrolls the whole page sideways. */}
      <Table.ScrollContainer minWidth={420}>
        <Table withTableBorder withColumnBorders verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Service</Table.Th>
              <Table.Th scope="col" w={120}>
                Price
              </Table.Th>
              <Table.Th scope="col" w={80}>
                Qty
              </Table.Th>
              <Table.Th scope="col" w={120}>
                Total
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((line) => (
              <Table.Tr key={line.id}>
                <Table.Th scope="row" fw={400}>
                  <Text size="sm">{line.name}</Text>
                </Table.Th>
                <Table.Td>
                  <Text size="sm">
                    {formatCents(line.unitPriceCents)}/{CATALOG_UNIT_LABELS[line.unit]}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{line.quantity}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {formatCents(lineTotalCents(line))}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Group justify="flex-end" gap="sm">
        <Text size="sm" c="dimmed">
          Subtotal
        </Text>
        <Text fw={700} fz="lg">
          {formatCents(subtotalCents)}
        </Text>
      </Group>
    </Stack>
  )
}

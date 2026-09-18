// A sub-component reached as Table.Td resolves to undefined in the browser chunk when a
// server component renders it, so the named exports are imported directly.
import {
  Group,
  Stack,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from '@mantine/core'
import { CATALOG_UNIT_LABELS, formatCents, lineTotalCents, type ContractLineRow } from '../schema'

export interface ContractLinesTableProps {
  lines: readonly Pick<ContractLineRow, 'id' | 'name' | 'unitPriceCents' | 'quantity' | 'unit'>[]
  subtotalCents: number
}

export function ContractLinesTable({ lines, subtotalCents }: ContractLinesTableProps) {
  return (
    <Stack gap="xs">
      {/* Scrolls inside its own box, so a narrow screen never scrolls the whole page sideways. */}
      <TableScrollContainer minWidth={420}>
        <Table withTableBorder withColumnBorders verticalSpacing="xs">
          <TableThead>
            <TableTr>
              <TableTh scope="col">Service</TableTh>
              <TableTh scope="col" w={120}>
                Price
              </TableTh>
              <TableTh scope="col" w={80}>
                Qty
              </TableTh>
              <TableTh scope="col" w={120}>
                Total
              </TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {lines.map((line) => (
              <TableTr key={line.id}>
                <TableTh scope="row" fw={400}>
                  <Text size="sm">{line.name}</Text>
                </TableTh>
                <TableTd>
                  <Text size="sm">
                    {formatCents(line.unitPriceCents)}/{CATALOG_UNIT_LABELS[line.unit]}
                  </Text>
                </TableTd>
                <TableTd>
                  <Text size="sm">{line.quantity}</Text>
                </TableTd>
                <TableTd>
                  <Text size="sm" fw={500}>
                    {formatCents(lineTotalCents(line))}
                  </Text>
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      </TableScrollContainer>
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

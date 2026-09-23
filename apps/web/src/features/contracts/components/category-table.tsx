import { Badge, Group, Table, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { formatPriceRange, type CatalogItemRow } from '../schema'

export function CategoryTable({
  label,
  items,
  actions,
}: {
  label: string
  items: readonly CatalogItemRow[]
  /** Only where the viewer may change the card. */
  actions?: (item: CatalogItemRow) => ReactNode
}) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table withTableBorder withColumnBorders striped verticalSpacing="xs" aria-label={label}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Service</Table.Th>
            <Table.Th scope="col">Description</Table.Th>
            <Table.Th scope="col" w={220}>
              Price
            </Table.Th>
            {actions ? (
              <Table.Th scope="col" w={90} ta="right">
                Actions
              </Table.Th>
            ) : null}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Th scope="row" fw={500}>
                <Text size="sm" fw={500}>
                  {item.name}
                </Text>
              </Table.Th>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {item.description ?? '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="wrap">
                  <Text size="sm" fw={500}>
                    {/* A surcharge has no fee of its own, so a zero range would read as free. */}
                    {item.priceMaxCents === 0 ? 'Surcharge' : formatPriceRange(item)}
                  </Text>
                  {item.percentOfSpend ? (
                    <Badge variant="light" size="sm">
                      or {item.percentOfSpend}% of spend
                    </Badge>
                  ) : null}
                </Group>
              </Table.Td>
              {actions ? <Table.Td ta="right">{actions(item)}</Table.Td> : null}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

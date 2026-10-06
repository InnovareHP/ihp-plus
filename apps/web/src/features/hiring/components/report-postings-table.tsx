import { Table, Text } from '@mantine/core'
import { LinkAnchor } from '@/components/link-anchor'
import { postingRoute } from '@/lib/routes'
import type { ReportPostingRow } from '../schema'
import { formatDays } from '../utils/report'

const number = new Intl.NumberFormat('en-US')

export interface ReportPostingsTableProps {
  rows: readonly ReportPostingRow[]
}

export function ReportPostingsTable({ rows }: ReportPostingsTableProps) {
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped verticalSpacing="xs" stickyHeader aria-label="Outcomes by posting">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Posting</Table.Th>
            <Table.Th scope="col" ta="right">
              Applied
            </Table.Th>
            <Table.Th scope="col" ta="right">
              In progress
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Hired
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Rejected
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Withdrew
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Median time to hire
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Th scope="row" fw={500}>
                <LinkAnchor href={postingRoute(row.id)} size="sm" fw={500}>
                  {row.title}
                </LinkAnchor>
              </Table.Th>
              <Table.Td ta="right">{number.format(row.applications)}</Table.Td>
              <Table.Td ta="right">{number.format(row.active)}</Table.Td>
              <Table.Td ta="right">{number.format(row.hired)}</Table.Td>
              <Table.Td ta="right">{number.format(row.rejected)}</Table.Td>
              <Table.Td ta="right">{number.format(row.withdrawn)}</Table.Td>
              <Table.Td ta="right">
                <Text size="sm" c={row.medianDaysToHire === undefined ? 'dimmed' : undefined}>
                  {formatDays(row.medianDaysToHire)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

import { Table, Text } from '@mantine/core'

export interface ReportColumn<Row> {
  label: string
  value: (row: Row) => string
  numeric?: boolean
}

export interface ReportTableProps<Row> {
  caption: string
  columns: ReportColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  empty: string
}

export function ReportTable<Row>({ caption, columns, rows, rowKey, empty }: ReportTableProps<Row>) {
  return (
    <Table.ScrollContainer minWidth={360}>
      <Table striped highlightOnHover verticalSpacing="xs" captionSide="top">
        <Table.Caption ta="left" fw={600} c="var(--mantine-color-text)">
          {caption}
        </Table.Caption>
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column.label} scope="col" ta={column.numeric ? 'right' : 'left'}>
                {column.label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Text size="sm">{empty}</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => (
              <Table.Tr key={rowKey(row)}>
                {columns.map((column, index) => (
                  <Table.Td
                    key={column.label}
                    ta={column.numeric ? 'right' : 'left'}
                    // Long page paths wrap anywhere instead of pushing the numbers off screen.
                    style={index === 0 ? { overflowWrap: 'anywhere' } : undefined}
                  >
                    {column.value(row)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

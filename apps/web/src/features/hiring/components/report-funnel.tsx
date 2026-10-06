import { Progress, Table, Text } from '@mantine/core'
import type { ReportFunnelStep } from '../schema'
import { formatShare, shareOf } from '../utils/report'

const number = new Intl.NumberFormat('en-US')

export interface ReportFunnelProps {
  steps: readonly ReportFunnelStep[]
  applications: number
}

export function ReportFunnel({ steps, applications }: ReportFunnelProps) {
  return (
    <Table.ScrollContainer minWidth={480}>
      <Table verticalSpacing="xs" aria-label="Applicants reaching each stage">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Stage</Table.Th>
            <Table.Th scope="col" ta="right" w={100}>
              Reached
            </Table.Th>
            <Table.Th scope="col">Share of applicants</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {steps.map((step) => (
            <Table.Tr key={step.name}>
              <Table.Th scope="row" fw={500}>
                <Text size="sm" fw={500}>
                  {step.name}
                </Text>
              </Table.Th>
              <Table.Td ta="right">{number.format(step.reached)}</Table.Td>
              <Table.Td>
                <Progress
                  value={shareOf(step.reached, applications) * 100}
                  size="lg"
                  aria-label={`${step.name}: ${formatShare(step.reached, applications)} of applicants`}
                />
                <Text size="xs" c="dimmed" mt={4}>
                  {formatShare(step.reached, applications)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

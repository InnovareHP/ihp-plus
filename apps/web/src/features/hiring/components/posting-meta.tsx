import { Badge, Group, Text } from '@mantine/core'
import {
  EMPLOYMENT_TYPE_LABELS,
  salaryLabel,
  WORKPLACE_LABELS,
  type EmploymentType,
  type SalaryPeriod,
  type Workplace,
} from '../schema'

export interface PostingMetaProps {
  teamName: string | undefined
  employmentType: EmploymentType
  workplace: Workplace
  location: string
  salaryMin: number | undefined
  salaryMax: number | undefined
  salaryCurrency: string
  salaryPeriod: SalaryPeriod
}

/** The facts an applicant scans for first: where, how, and what it pays. */
export function PostingMeta(props: PostingMetaProps) {
  const pay = salaryLabel(props)

  return (
    <Group gap="xs" wrap="wrap">
      {props.teamName ? (
        <Badge variant="light" color="gray">
          {props.teamName}
        </Badge>
      ) : null}
      <Badge variant="light">{EMPLOYMENT_TYPE_LABELS[props.employmentType]}</Badge>
      <Badge variant="light" color="teal">
        {WORKPLACE_LABELS[props.workplace]}
      </Badge>
      {props.location ? (
        <Text size="sm" c="dimmed">
          {props.location}
        </Text>
      ) : null}
      {pay ? (
        <Text size="sm" fw={600}>
          {pay}
        </Text>
      ) : null}
    </Group>
  )
}

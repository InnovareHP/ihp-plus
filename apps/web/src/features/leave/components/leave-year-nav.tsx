import { Group, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { LinkButton } from '@/components/link-button'
import { MAX_LEAVE_YEAR, MIN_LEAVE_YEAR } from '../schema'

export interface LeaveYearNavProps {
  year: number
  /** The page this nav sits on, so the year links stay on it. */
  pathname: string
}

export function LeaveYearNav({ year, pathname }: LeaveYearNavProps) {
  return (
    <Group gap="xs" component="nav" aria-label="Leave year">
      <LinkButton
        href={`${pathname}?year=${year - 1}`}
        variant="default"
        leftSection={<IconChevronLeft size={16} aria-hidden="true" />}
        disabled={year <= MIN_LEAVE_YEAR}
        aria-label={`Show ${year - 1}`}
      >
        {year - 1}
      </LinkButton>
      <Text fw={700} fz="lg" miw={64} ta="center" aria-current="page">
        {year}
      </Text>
      <LinkButton
        href={`${pathname}?year=${year + 1}`}
        variant="default"
        rightSection={<IconChevronRight size={16} aria-hidden="true" />}
        disabled={year >= MAX_LEAVE_YEAR}
        aria-label={`Show ${year + 1}`}
      >
        {year + 1}
      </LinkButton>
    </Group>
  )
}

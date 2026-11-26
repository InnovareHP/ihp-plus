'use client'

import { Alert, Button, Group, List, Stack, Text } from '@mantine/core'
import { IconFileZip } from '@tabler/icons-react'
import { PageSection } from '@/components/page-section'
import type { DayRange } from '../days'
import { rangeLabel } from '../report-range'
import { REPORT_SITES } from '../sites'

export interface AllReportsSectionProps {
  range: DayRange
  /** Site keys with takeaways saved for this range; undefined while that is still loading. */
  withTakeaways: string[] | undefined
  downloading: boolean
  /** Sites the last zip had to leave out, with why. */
  failed: { site: string; message: string }[]
  onDownload: () => void
}

export function AllReportsSection({
  range,
  withTakeaways,
  downloading,
  failed,
  onDownload,
}: AllReportsSectionProps) {
  const missing = withTakeaways
    ? REPORT_SITES.filter((site) => !withTakeaways.includes(site.key))
    : []

  return (
    <PageSection
      title="All client reports"
      description={`Every website's PDF for ${rangeLabel(range)} in one zip, ready to forward to each client.`}
    >
      <Stack gap="sm">
        <Text size="sm" aria-live="polite">
          {withTakeaways === undefined
            ? 'Checking which reports have takeaways…'
            : `Takeaways saved for ${REPORT_SITES.length - missing.length} of ${REPORT_SITES.length} websites.`}
        </Text>
        {missing.length > 0 ? (
          <Stack gap={4}>
            <Text size="sm">
              These still print without takeaways; pick each one above to write them:
            </Text>
            <List size="sm" spacing={2}>
              {missing.map((site) => (
                <List.Item key={site.key}>{site.name}</List.Item>
              ))}
            </List>
          </Stack>
        ) : null}

        {failed.length > 0 ? (
          <Alert
            color="red"
            variant="light"
            role="alert"
            title="Some reports were left out of the zip"
          >
            <List size="sm" spacing={2}>
              {failed.map((one) => (
                <List.Item key={one.site}>{one.message}</List.Item>
              ))}
            </List>
          </Alert>
        ) : null}

        <Group>
          <Button
            leftSection={<IconFileZip size={16} aria-hidden />}
            onClick={onDownload}
            loading={downloading}
          >
            Download all {REPORT_SITES.length} reports
          </Button>
        </Group>
        {downloading ? (
          <Text size="sm" role="status">
            Building {REPORT_SITES.length} reports. This takes about a minute.
          </Text>
        ) : null}
      </Stack>
    </PageSection>
  )
}

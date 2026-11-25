import { SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { Ga4Seo } from '../ga4'
import { formatCount, formatDecimal, formatPercent } from '../format'
import { ReportTable } from './report-table'
import { StatTile } from './stat-tile'

export function SeoSection({ seo }: { seo: Ga4Seo | null }) {
  return (
    <Stack gap="md" component="section" aria-labelledby="seo-heading">
      <Stack gap={2}>
        <Title order={3} size="h5" id="seo-heading">
          Google search
        </Title>
        <Text size="sm">
          How often Google showed the site in results, and how often people clicked.
        </Text>
      </Stack>

      {seo ? (
        <>
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
            <StatTile label="Clicks" value={formatCount(seo.clicks)} />
            <StatTile label="Impressions" value={formatCount(seo.impressions)} />
            <StatTile label="Click-through rate" value={formatPercent(seo.clickThroughRate)} />
            <StatTile label="Average position" value={formatDecimal(seo.averagePosition)} />
          </SimpleGrid>
          <ReportTable
            caption="Top pages in Google search"
            rows={seo.pages}
            rowKey={(row) => row.page}
            empty="No pages showed in Google search."
            columns={[
              { label: 'Page', value: (row) => row.page },
              { label: 'Clicks', value: (row) => formatCount(row.clicks), numeric: true },
              {
                label: 'Impressions',
                value: (row) => formatCount(row.impressions),
                numeric: true,
              },
              { label: 'Position', value: (row) => formatDecimal(row.position), numeric: true },
            ]}
          />
        </>
      ) : (
        <Text size="sm">
          Google has no search data for this range yet. Search Console takes a few days to send it,
          so try a range that ends a little earlier.
        </Text>
      )}
    </Stack>
  )
}

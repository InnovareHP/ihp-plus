export const analyticsKeys = {
  all: ['website-analytics'] as const,
  ga4: (siteKey: string, start: string, end: string) =>
    [...analyticsKeys.all, 'ga4', siteKey, start, end] as const,
}

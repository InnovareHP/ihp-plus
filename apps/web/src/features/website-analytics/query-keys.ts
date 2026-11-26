export const analyticsKeys = {
  all: ['website-analytics'] as const,
  ga4: (siteKey: string, start: string, end: string) =>
    [...analyticsKeys.all, 'ga4', siteKey, start, end] as const,
  netlify: (siteKey: string, start: string, end: string) =>
    [...analyticsKeys.all, 'netlify', siteKey, start, end] as const,
  takeaways: (siteKey: string, start: string, end: string) =>
    [...analyticsKeys.all, 'takeaways', siteKey, start, end] as const,
  takeawayStatus: (start: string, end: string) =>
    [...analyticsKeys.all, 'takeaway-status', start, end] as const,
}

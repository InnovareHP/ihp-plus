export const websiteKeys = {
  all: ['websites'] as const,
  checklists: () => [...websiteKeys.all, 'checklist'] as const,
  // An empty date is "today", which the server resolves in the attendance time zone.
  checklist: (date: string) => [...websiteKeys.checklists(), date] as const,
  clientOptions: () => [...websiteKeys.all, 'client-options'] as const,
  websiteOptions: () => [...websiteKeys.all, 'website-options'] as const,
}

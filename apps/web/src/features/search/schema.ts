import { z } from 'zod'

export const searchEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['page']),
  label: z.string().min(1),
  description: z.string().optional(),
  /** The sidebar area a page sits in, shown as a badge beside its name. */
  area: z.string().optional(),
  // Recent entries come back out of localStorage, which anyone can edit, so only in-app paths pass.
  href: z.string().refine((value) => value.startsWith('/') && !value.startsWith('//')),
  keywords: z.array(z.string()).optional(),
})

export type SearchEntry = z.infer<typeof searchEntrySchema>

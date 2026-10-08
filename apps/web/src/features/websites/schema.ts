import { z } from 'zod'

/** The two moments a day the IT lead checks every site: arriving and leaving. */
export const CHECK_ROUNDS = ['clock_in', 'clock_out'] as const
export type CheckRound = (typeof CHECK_ROUNDS)[number]

export const CHECK_ROUND_LABELS: Record<CheckRound, string> = {
  clock_in: 'Time in',
  clock_out: 'Time out',
}

export const CHECK_STATUSES = ['up', 'issue', 'down'] as const
export type CheckStatus = (typeof CHECK_STATUSES)[number]

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  up: 'Running',
  issue: 'Issue',
  down: 'Down',
}

export const CHECK_STATUS_COLORS: Record<CheckStatus, string> = {
  up: 'teal',
  issue: 'yellow',
  down: 'red',
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

export const dateKeySchema = z.string().regex(DATE_KEY, 'Pick a valid date.')
export const monthKeySchema = z.string().regex(MONTH_KEY, 'Pick a month.')

// Only http and https: anything else is not a website a browser or the probe can open.
const websiteUrl = z
  .string()
  .trim()
  .min(1, 'Enter the website address.')
  .pipe(z.url({ protocol: /^https?$/, message: 'Enter a full address starting with https://.' }))

export const websiteDraftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the website.')
    .max(120, 'Keep the name under 120 characters.'),
  url: websiteUrl,
  clientId: z.string(),
  notes: z.string().max(1000, 'Keep notes under 1,000 characters.'),
})

export type WebsiteDraftInput = z.input<typeof websiteDraftSchema>
export type WebsiteDraftValues = z.output<typeof websiteDraftSchema>

export const updateWebsiteSchema = websiteDraftSchema.extend({ id: z.string().min(1) })
export type UpdateWebsiteValues = z.output<typeof updateWebsiteSchema>

export const EMPTY_WEBSITE_DRAFT: WebsiteDraftInput = { name: '', url: '', clientId: '', notes: '' }

export const recordCheckSchema = z.object({
  websiteId: z.string().min(1),
  round: z.enum(CHECK_ROUNDS),
  status: z.enum(CHECK_STATUSES),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.'),
})

export type RecordCheckValues = z.output<typeof recordCheckSchema>

// A site marked anything but running needs a reason, or the month's file says nothing useful.
export const checkNoteFormSchema = recordCheckSchema
  .pick({ status: true, note: true })
  .refine((values) => values.status === 'up' || values.note.length > 0, {
    path: ['note'],
    message: 'Say what is wrong so the next person knows.',
  })

export type CheckNoteFormInput = z.input<typeof checkNoteFormSchema>

// An empty websiteId is every site; one id narrows the report to that site.
export const exportMonthSchema = z.object({ month: monthKeySchema, websiteId: z.string() })
export type ExportMonthValues = z.output<typeof exportMonthSchema>

export const itTeamSchema = z.object({ itTeamId: z.string() })
export type ItTeamValues = z.output<typeof itTeamSchema>

export interface WebsiteCheckRow {
  status: CheckStatus
  httpStatus: number | undefined
  responseMs: number | undefined
  error: string
  note: string
  checkedByName: string
  checkedAt: string
}

export interface WebsiteRow {
  id: string
  name: string
  url: string
  clientId: string
  clientName: string
  notes: string
  checks: Partial<Record<CheckRound, WebsiteCheckRow>>
}

export interface Checklist {
  date: string
  today: string
  timeZone: string
  websites: WebsiteRow[]
}

export interface WebsitesAccess {
  canCheck: boolean
  canManage: boolean
  canConfigure: boolean
  itTeamId: string | undefined
}

export interface ClientOption {
  id: string
  name: string
}

/** One website on one day of the month, both rounds side by side, as the CSV wants it. */
export interface MonthExportRow {
  date: string
  website: string
  url: string
  client: string
  checks: Partial<Record<CheckRound, WebsiteCheckRow>>
}

export interface MonthExport {
  month: string
  timeZone: string
  /** Set when the report covers one site, so the file can be named after it. */
  websiteName: string | undefined
  rows: MonthExportRow[]
}

export interface WebsiteOption {
  id: string
  name: string
  /** Taken off the list since; still reportable for the months it was watched. */
  removed: boolean
}

/** Who a check is recorded against when nobody pressed the button. */
export const AUTOMATIC_CHECKER_ID = 'automatic'
export const AUTOMATIC_CHECKER_NAME = 'Automatic check'

import { z } from 'zod'

export const MIN_LEAVE_YEAR = 2000
export const MAX_LEAVE_YEAR = 2100

export const leaveYearSchema = z.coerce
  .number()
  .int()
  .min(MIN_LEAVE_YEAR)
  .max(MAX_LEAVE_YEAR)
  .optional()
  .catch(undefined)

export const leaveQuerySchema = z.object({ year: leaveYearSchema })

export type LeaveQuery = z.infer<typeof leaveQuerySchema>

export interface LeaveBalance {
  formId: string
  formName: string
  allowance: number
  used: number
  pending: number
  /** Negative once an approver has allowed more than the allowance. */
  remaining: number
  /** The allowance is this person's own rather than the form's. */
  overridden: boolean
}

export interface MyLeaveBalances {
  year: number
  balances: LeaveBalance[]
}

export interface FormAllowance {
  formId: string
  formName: string
  allowance: number
}

export interface PersonBalances {
  userId: string
  name: string
  balances: LeaveBalance[]
}

export interface TeamLeaveBalances {
  year: number
  forms: FormAllowance[]
  people: PersonBalances[]
}

export interface LeavePreview {
  workingDays: number
  balance: LeaveBalance | undefined
}

export type LeavePreviewInput =
  { submissionId: string } | { formId: string; firstDay: string; lastDay: string }

export const allowanceFormSchema = z.object({
  days: z
    .number('Enter a number of days.')
    .int('Use whole days.')
    .min(0, 'The allowance cannot be negative.')
    .max(366, 'A year has at most 366 days.'),
})

export type AllowanceFormValues = z.infer<typeof allowanceFormSchema>

export const setAllowanceSchema = z.object({
  formId: z.string().min(1),
  userId: z.string().min(1),
  /** Undefined puts the person back on the form's allowance. */
  days: allowanceFormSchema.shape.days.optional(),
})

export type SetAllowanceValues = z.infer<typeof setAllowanceSchema>

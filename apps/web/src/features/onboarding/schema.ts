import { z } from 'zod'
import { EMPLOYMENT_TYPES, POSITIONS } from './options'

const MIN_AGE = 16
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const PHONE = /^[\d\s()+.-]{7,20}$/

// `new Date('2026-02-31')` rolls over instead of failing, so the round-trip is the real check.
function isRealDate(value: string) {
  if (!ISO_DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

function yearsAgo(years: number) {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
}

function isBornBefore(value: string, cutoff: Date) {
  return new Date(`${value}T00:00:00.000Z`) <= cutoff
}

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`)

const personalFields = {
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(60, 'First name must be 60 characters or fewer'),
  middleInitial: z
    .string()
    .trim()
    .max(1, 'Enter a single initial')
    .regex(/^[A-Za-z]?$/, 'Use one letter, with no punctuation'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(60, 'Last name must be 60 characters or fewer'),
  preferredName: optionalText(60, 'Preferred name'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || PHONE.test(value), 'Enter a phone number we can dial'),
  dateOfBirth: z
    .string()
    .trim()
    .refine((value) => value === '' || isRealDate(value), 'Enter a date as YYYY-MM-DD')
    .refine(
      (value) => value === '' || !isRealDate(value) || isBornBefore(value, yearsAgo(MIN_AGE)),
      `You must be at least ${MIN_AGE} to use the portal`,
    ),
}

const employmentFields = {
  jobTitle: z.enum(POSITIONS, 'Select your current position'),
  // A team id, checked against the organization server-side; the client cannot be trusted.
  teamId: z.string().min(1, 'Select your department'),
  employmentType: z.enum(EMPLOYMENT_TYPES, 'Select your employment type'),
  startDate: z
    .string()
    .trim()
    .min(1, 'Your start date is required')
    .refine((value) => value === '' || isRealDate(value), 'Enter a date as YYYY-MM-DD'),
}

// Holds the object key the upload action returned, never the file itself.
const photoFields = {
  photoKey: z.string().min(1, 'Add a photo to finish setup'),
}

const confirmFields = {
  confirmed: z.boolean().refine((value) => value, 'Confirm that these details are correct'),
}

export const personalStepSchema = z.object(personalFields)
export const employmentStepSchema = z.object(employmentFields)
export const onboardingSchema = z.object({
  ...personalFields,
  ...employmentFields,
  ...photoFields,
  ...confirmFields,
})

export type OnboardingValues = z.infer<typeof onboardingSchema>
export type OnboardingField = keyof OnboardingValues

export interface OnboardingStep {
  label: string
  description: string
  fields: readonly OnboardingField[]
}

export const ONBOARDING_STEPS = [
  {
    label: 'About you',
    description: 'Name and contact',
    fields: ['firstName', 'middleInitial', 'lastName', 'preferredName', 'phone', 'dateOfBirth'],
  },
  {
    label: 'Your role',
    description: 'Position and employment',
    fields: ['jobTitle', 'teamId', 'employmentType', 'startDate'],
  },
  { label: 'Photo', description: 'For your company ID', fields: ['photoKey'] },
  { label: 'Review', description: 'Confirm and finish', fields: ['confirmed'] },
] as const satisfies readonly OnboardingStep[]

export const LAST_STEP = ONBOARDING_STEPS.length - 1

export function stepFields(step: number): readonly OnboardingField[] {
  return ONBOARDING_STEPS[step]?.fields ?? []
}

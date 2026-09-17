import { describe, expect, it } from 'vitest'
import { employmentStepSchema, onboardingSchema, personalStepSchema, stepFields } from './schema'

const validPersonal = {
  firstName: 'Ada',
  middleInitial: 'B',
  lastName: 'Lovelace',
  preferredName: '',
  phone: '',
  dateOfBirth: '',
}

const validEmployment = {
  jobTitle: 'Data Analyst',
  teamId: 'team-it',
  employmentType: 'Full-time',
  startDate: '2026-01-05',
}

function personalError(overrides: Partial<typeof validPersonal>) {
  const result = personalStepSchema.safeParse({ ...validPersonal, ...overrides })
  return result.success ? undefined : result.error.issues[0]?.message
}

function employmentError(overrides: Partial<typeof validEmployment>) {
  const result = employmentStepSchema.safeParse({ ...validEmployment, ...overrides })
  return result.success ? undefined : result.error.issues[0]?.message
}

describe('personalStepSchema', () => {
  it('accepts the required names with every optional field blank', () => {
    expect(personalError({})).toBeUndefined()
  })

  it('requires a first and last name', () => {
    expect(personalError({ firstName: '  ' })).toBe('First name is required')
    expect(personalError({ lastName: '' })).toBe('Last name is required')
  })

  it('holds the middle initial to one letter', () => {
    expect(personalError({ middleInitial: 'Bee' })).toBe('Enter a single initial')
    expect(personalError({ middleInitial: '.' })).toBe('Use one letter, with no punctuation')
  })

  it('rejects a phone number that cannot be dialled', () => {
    expect(personalError({ phone: 'call me' })).toBe('Enter a phone number we can dial')
    expect(personalError({ phone: '+1 (555) 010-2030' })).toBeUndefined()
  })

  it('rejects a date of birth that never existed', () => {
    expect(personalError({ dateOfBirth: '1990-02-31' })).toBe('Enter a date as YYYY-MM-DD')
  })

  it('rejects a date of birth under the minimum age', () => {
    const lastYear = new Date()
    lastYear.setUTCFullYear(lastYear.getUTCFullYear() - 1)
    expect(personalError({ dateOfBirth: lastYear.toISOString().slice(0, 10) })).toBe(
      'You must be at least 16 to use the portal',
    )
  })
})

describe('employmentStepSchema', () => {
  it('accepts a seeded position, department and employment type', () => {
    expect(employmentError({})).toBeUndefined()
  })

  it('requires a position to be chosen', () => {
    // The positions are curated per organization now, so membership of the list is checked in
    // completeOnboarding rather than against a union compiled into the bundle.
    expect(employmentError({ jobTitle: '' })).toBe('Select your current position')
  })

  it('requires an employment type to be chosen', () => {
    expect(employmentError({ employmentType: '' })).toBe('Select your employment type')
  })

  it('requires a department to be chosen', () => {
    // A team id is a free string here; that it belongs to the org is checked server-side.
    expect(employmentError({ teamId: '' })).toBe('Select your department')
  })

  it('requires a start date', () => {
    expect(employmentError({ startDate: '' })).toBe('Your start date is required')
  })
})

describe('onboardingSchema', () => {
  const complete = {
    ...validPersonal,
    ...validEmployment,
    photoKey: 'users/u1/photo-abc.jpg',
    confirmed: true,
  }

  it('accepts a complete profile', () => {
    expect(onboardingSchema.safeParse(complete).success).toBe(true)
  })

  it('refuses to submit until the confirmation box is ticked', () => {
    const result = onboardingSchema.safeParse({ ...complete, confirmed: false })
    expect(result.success).toBe(false)
  })

  it('refuses to submit without an uploaded photo', () => {
    const result = onboardingSchema.safeParse({ ...complete, photoKey: '' })
    expect(result.success).toBe(false)
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe(
      'Add a photo to finish setup',
    )
  })
})

describe('step metadata', () => {
  it('maps every field to exactly one step', () => {
    const all = [0, 1, 2, 3].flatMap((step) => stepFields(step))
    expect(new Set(all).size).toBe(all.length)
    expect(stepFields(1)).toContain('startDate')
    expect(stepFields(2)).toEqual(['photoKey'])
    expect(stepFields(3)).toEqual(['confirmed'])
  })
})

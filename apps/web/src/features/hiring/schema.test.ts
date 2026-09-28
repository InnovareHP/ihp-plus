import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGES, postingDraftSchema, salaryLabel, stagesSchema } from './schema'
import { slugOf } from './slug'

describe('stages', () => {
  it('accepts the defaults', () => {
    expect(stagesSchema.safeParse(DEFAULT_STAGES).success).toBe(true)
  })

  it('keeps the entry stage first', () => {
    const [entry, ...rest] = DEFAULT_STAGES
    const result = stagesSchema.safeParse([...rest, entry])

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'The first stage is where applications land, so it stays first.',
    )
  })

  it('refuses two stages with the same name, whatever the case', () => {
    const result = stagesSchema.safeParse([
      ...DEFAULT_STAGES,
      { id: 'second-interview', name: 'INTERVIEW', message: '' },
    ])

    expect(result.error?.issues[0]?.message).toBe('Give every stage a different name.')
  })
})

describe('posting draft', () => {
  const DRAFT = {
    title: 'Registered nurse',
    description: 'You will care for patients across our outpatient clinics.',
    workplace: 'onsite',
    employmentType: 'full_time',
    stages: DEFAULT_STAGES,
  }

  it('fills the optional fields with their defaults', () => {
    expect(postingDraftSchema.parse(DRAFT)).toMatchObject({
      salaryMin: '',
      salaryMax: '',
      salaryCurrency: 'USD',
      resumeRequired: true,
      closesAt: '',
    })
  })

  it('refuses a pay range that runs backwards', () => {
    const result = postingDraftSchema.safeParse({ ...DRAFT, salaryMin: 50, salaryMax: 10 })

    expect(result.error?.issues[0]).toMatchObject({
      path: ['salaryMax'],
      message: 'The lowest pay cannot be above the highest.',
    })
  })
})

describe('salaryLabel', () => {
  it('reads a range, a floor, a ceiling, or nothing', () => {
    const base = { salaryCurrency: 'USD' }
    expect(salaryLabel({ ...base, salaryMin: 50000, salaryMax: 60000 })).toBe('$50,000 – $60,000')
    expect(salaryLabel({ ...base, salaryMin: 50000, salaryMax: undefined })).toBe('From $50,000')
    expect(salaryLabel({ ...base, salaryMin: undefined, salaryMax: 60000 })).toBe('Up to $60,000')
    expect(salaryLabel({ ...base, salaryMin: undefined, salaryMax: undefined })).toBeUndefined()
  })
})

describe('slugOf', () => {
  it('keeps words, drops accents and punctuation, and adds a short tail', () => {
    expect(slugOf('Café Barista (Part-time)!', 'AB12-cd34-ef')).toBe(
      'cafe-barista-part-time-ab12cd',
    )
  })

  it('still produces a slug from a title with no letters in it', () => {
    expect(slugOf('!!!', 'abcdef99')).toBe('job-abcdef')
  })
})

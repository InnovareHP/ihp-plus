import { describe, expect, it } from 'vitest'
import {
  answerSchemaOf,
  decisionSchema,
  defaultAnswersOf,
  formDraftSchema,
  publishBlockers,
  REJECTION_NEEDS_REASON,
  type FormField,
} from './schema'

function field(
  overrides: Partial<FormField> & Pick<FormField, 'id' | 'type' | 'label'>,
): FormField {
  return { help: '', placeholder: '', required: false, options: [], ...overrides }
}

const REASON = field({ id: 'reason', type: 'textarea', label: 'Reason', required: true })
const COST = field({ id: 'cost', type: 'number', label: 'Estimated cost', min: 0, max: 5000 })
const SIZE = field({ id: 'size', type: 'select', label: 'Size', options: ['S', 'M', 'L'] })
const TERMS = field({ id: 'terms', type: 'checkbox', label: 'I have read the policy' })

describe('answerSchemaOf', () => {
  it('requires the fields the admin marked required', () => {
    const result = answerSchemaOf([REASON]).safeParse({ reason: '' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Reason is required.')
  })

  it('accepts an empty answer to an optional field', () => {
    expect(answerSchemaOf([COST]).safeParse({ cost: '' }).success).toBe(true)
  })

  it('holds a number to the range the admin set', () => {
    expect(answerSchemaOf([COST]).safeParse({ cost: 250 }).success).toBe(true)
    expect(answerSchemaOf([COST]).safeParse({ cost: 9000 }).success).toBe(false)
    expect(answerSchemaOf([COST]).safeParse({ cost: -1 }).success).toBe(false)
  })

  it('only accepts one of the options a choice question offers', () => {
    expect(answerSchemaOf([SIZE]).safeParse({ size: 'M' }).success).toBe(true)
    expect(answerSchemaOf([SIZE]).safeParse({ size: 'XL' }).success).toBe(false)
  })

  it('treats a required checkbox as one that has to be ticked', () => {
    const required = { ...TERMS, required: true }

    expect(answerSchemaOf([required]).safeParse({ terms: false }).success).toBe(false)
    expect(answerSchemaOf([required]).safeParse({ terms: true }).success).toBe(true)
    expect(answerSchemaOf([TERMS]).safeParse({ terms: false }).success).toBe(true)
  })

  it('starts a checkbox unticked and everything else blank', () => {
    expect(defaultAnswersOf([REASON, COST, TERMS])).toEqual({
      reason: '',
      cost: '',
      terms: false,
    })
  })
})

describe('file questions', () => {
  const RECEIPT = field({ id: 'receipt', type: 'file', label: 'Receipt', required: true })

  it('asks for a required file by name', () => {
    const result = answerSchemaOf([RECEIPT]).safeParse({ receipt: '' })

    expect(result.error?.issues[0]?.message).toBe('Attach receipt.')
    expect(answerSchemaOf([RECEIPT]).safeParse({ receipt: 'file-1' }).success).toBe(true)
  })

  it('keeps a file question off an evaluation form', () => {
    const draft = { name: 'Quarterly review', fields: [RECEIPT], teamIds: [] }

    expect(formDraftSchema.safeParse({ ...draft, kind: 'request' }).success).toBe(true)
    expect(
      formDraftSchema.safeParse({ ...draft, kind: 'evaluation' }).error?.issues[0]?.message,
    ).toBe('An evaluation form cannot ask for a file.')
  })
})

describe('publishBlockers', () => {
  it('refuses a form nobody can answer or reach', () => {
    expect(publishBlockers({ kind: 'request', fields: [], teams: [] })).toEqual([
      'Add at least one question.',
      'Pick at least one department.',
    ])
  })

  it('names only the half that is missing', () => {
    expect(publishBlockers({ kind: 'request', fields: [REASON], teams: [] })).toEqual([
      'Pick at least one department.',
    ])
    expect(publishBlockers({ kind: 'request', fields: [], teams: ['team-1'] })).toEqual([
      'Add at least one question.',
    ])
  })

  it('passes a form with both', () => {
    expect(publishBlockers({ kind: 'request', fields: [REASON], teams: ['team-1'] })).toEqual([])
  })

  it('asks an evaluation form for questions only, since it reaches people by assignment', () => {
    expect(publishBlockers({ kind: 'evaluation', fields: [REASON], teams: [] })).toEqual([])
    expect(publishBlockers({ kind: 'evaluation', fields: [], teams: [] })).toEqual([
      'Add at least one question.',
    ])
  })
})

describe('decisionSchema', () => {
  it('refuses a rejection with no reason, so the requester is not left guessing', () => {
    const result = decisionSchema.safeParse({
      submissionId: 'req-1',
      decision: 'rejected',
      note: '   ',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(REJECTION_NEEDS_REASON)
  })

  it('allows an approval with no note', () => {
    expect(
      decisionSchema.safeParse({ submissionId: 'req-1', decision: 'approved', note: '' }).success,
    ).toBe(true)
  })
})

describe('formDraftSchema', () => {
  it('rejects a choice question with no options', () => {
    const result = formDraftSchema.safeParse({
      name: 'Equipment request',
      description: '',
      teamIds: ['team-1'],
      fields: [{ id: 'a', type: 'select', label: 'Size', help: '', required: false, options: [] }],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('A choice question needs at least one option.')
  })

  it('rejects a number question whose range is inverted', () => {
    const result = formDraftSchema.safeParse({
      name: 'Equipment request',
      description: '',
      teamIds: ['team-1'],
      fields: [
        {
          id: 'a',
          type: 'number',
          label: 'Cost',
          help: '',
          required: false,
          options: [],
          min: 100,
          max: 10,
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('The lowest value cannot be above the highest.')
  })
})

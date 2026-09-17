import { describe, expect, it } from 'vitest'
import {
  BillingPlanError,
  MAX_SUBSCRIPTION_ITEMS,
  planBilling,
  type BillableLine,
} from './invoice-plan'

const NOW = new Date('2026-09-14T12:00:00.000Z')

function line(overrides: Partial<BillableLine> = {}): BillableLine {
  return {
    id: 'line-1',
    name: 'Social management',
    description: null,
    unitPriceCents: 250_000,
    quantity: 1,
    unit: 'month',
    ...overrides,
  }
}

const RETAINER = {
  id: 'contract-1',
  reference: 'IHP-C-0007',
  title: 'Growth retainer',
  billingCycle: 'monthly',
  startDate: null,
  endDate: null,
  lines: [line(), line({ id: 'line-2', name: 'Brand kit', unitPriceCents: 80_000, unit: 'once' })],
}

describe('planBilling', () => {
  it('bills a retainer monthly and puts its one-off lines on the first invoice', () => {
    const plan = planBilling(RETAINER, NOW)

    expect(plan.kind).toBe('subscription')
    if (plan.kind !== 'subscription') return
    expect(plan.recurring.map((item) => item.id)).toEqual(['line-1'])
    expect(plan.oneOff.map((item) => item.id)).toEqual(['line-2'])
    expect(plan.anchor).toBeUndefined()
    expect(plan.cancelAt).toBeUndefined()
  })

  it('puts every line of a one-off contract on a single invoice', () => {
    const plan = planBilling({ ...RETAINER, billingCycle: 'project' }, NOW)

    expect(plan).toMatchObject({ kind: 'invoice' })
    if (plan.kind !== 'invoice') return
    expect(plan.lines).toHaveLength(2)
  })

  it('refuses a monthly contract with nothing that recurs', () => {
    const setupOnly = { ...RETAINER, lines: [line({ unit: 'once' })] }

    expect(() => planBilling(setupOnly, NOW)).toThrow(BillingPlanError)
  })

  it('leaves free lines off the invoice, and refuses a contract with nothing priced', () => {
    const withFree = { ...RETAINER, lines: [line(), line({ id: 'free', unitPriceCents: 0 })] }
    const plan = planBilling(withFree, NOW)
    if (plan.kind !== 'subscription') throw new Error('expected a subscription')
    expect(plan.recurring.map((item) => item.id)).toEqual(['line-1'])

    expect(() => planBilling({ ...RETAINER, lines: [line({ unitPriceCents: 0 })] }, NOW)).toThrow(
      'nothing priced',
    )
  })

  it('anchors billing on a start date still to come, but not on one already past', () => {
    const later = planBilling({ ...RETAINER, startDate: new Date('2026-10-01T00:00:00.000Z') }, NOW)
    const earlier = planBilling(
      { ...RETAINER, startDate: new Date('2026-09-01T00:00:00.000Z') },
      NOW,
    )

    expect(later).toMatchObject({ anchor: 1790812800 })
    expect(earlier).toMatchObject({ anchor: undefined })
  })

  it('ends the subscription on the contract end date', () => {
    const plan = planBilling({ ...RETAINER, endDate: new Date('2027-09-01T00:00:00.000Z') }, NOW)

    expect(plan).toMatchObject({ cancelAt: 1819756800 })
  })

  it('refuses a contract whose end date has already passed', () => {
    const lapsed = { ...RETAINER, endDate: new Date('2026-09-01T00:00:00.000Z') }

    expect(() => planBilling(lapsed, NOW)).toThrow('ends before today')
  })

  it('refuses more recurring services than one subscription can carry', () => {
    const lines = Array.from({ length: MAX_SUBSCRIPTION_ITEMS + 1 }, (_, index) =>
      line({ id: `line-${index}` }),
    )

    expect(() => planBilling({ ...RETAINER, lines }, NOW)).toThrow(BillingPlanError)
  })
})

import { lineTotalCents } from '@/features/contracts/schema'

// Contracts are priced and formatted in dollars, so Stripe bills in the same currency.
export const BILLING_CURRENCY = 'usd'

// Clients are invoiced rather than charged, so no card has to be on file before work starts.
export const DAYS_UNTIL_DUE = 30

// Stripe's own ceiling on the items one subscription, or one first invoice, may carry.
export const MAX_SUBSCRIPTION_ITEMS = 20

export interface BillableLine {
  id: string
  name: string
  description: string | null
  unitPriceCents: number
  quantity: number
  unit: string
}

export interface BillableContract {
  id: string
  reference: string
  title: string
  billingCycle: string
  startDate: Date | null
  endDate: Date | null
  lines: readonly BillableLine[]
}

export type BillingPlan =
  | {
      kind: 'subscription'
      recurring: BillableLine[]
      oneOff: BillableLine[]
      /** Unix seconds, set only when the contract starts in the future. */
      anchor: number | undefined
      cancelAt: number | undefined
    }
  | { kind: 'invoice'; lines: BillableLine[] }

/** A contract that cannot be billed as it stands; the message says what to change. */
export class BillingPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BillingPlanError'
  }
}

function seconds(value: Date) {
  return Math.floor(value.getTime() / 1000)
}

export function planBilling(contract: BillableContract, now: Date): BillingPlan {
  // A free line would put a $0 row on every invoice without billing anything.
  const lines = contract.lines.filter((line) => lineTotalCents(line) > 0)
  if (lines.length === 0) {
    throw new BillingPlanError(`${contract.reference} has nothing priced to bill.`)
  }

  if (contract.endDate && contract.endDate <= now) {
    throw new BillingPlanError(
      `${contract.reference} ends before today. Return it to draft and fix the end date.`,
    )
  }

  if (contract.billingCycle === 'project') return { kind: 'invoice', lines }

  // A one-off line on a retainer is a setup fee: billed once, on the first invoice.
  const recurring = lines.filter((line) => line.unit !== 'once')
  const oneOff = lines.filter((line) => line.unit === 'once')

  if (recurring.length === 0) {
    throw new BillingPlanError(
      'A monthly contract needs at least one recurring service. Return it to draft and add one, or make it one-off.',
    )
  }

  if (recurring.length > MAX_SUBSCRIPTION_ITEMS || oneOff.length > MAX_SUBSCRIPTION_ITEMS) {
    throw new BillingPlanError(
      `Stripe bills at most ${MAX_SUBSCRIPTION_ITEMS} services of one kind on a contract. Return it to draft and combine some.`,
    )
  }

  return {
    kind: 'subscription',
    recurring,
    oneOff,
    anchor:
      contract.startDate && contract.startDate > now ? seconds(contract.startDate) : undefined,
    cancelAt: contract.endDate ? seconds(contract.endDate) : undefined,
  }
}

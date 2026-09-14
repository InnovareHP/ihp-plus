import { db } from '@ihp/db'
import { syncBilling } from '@/features/billing/contract-billing'
import { contractAcceptedTemplate, portalUrl, sendEmail } from '@/lib/email'
import { clientTab } from '@/lib/routes'
import { verifyContractLink } from './client-link'
import {
  contractAcceptanceSchema,
  type BillingCycle,
  type CatalogUnit,
  type ContractStatus,
} from './schema'

/** What a client sees through their link, which is deliberately less than a manager sees. */
export interface SharedContract {
  id: string
  reference: string
  title: string
  status: ContractStatus
  billingCycle: BillingCycle
  subtotalCents: number
  startDate: string | undefined
  endDate: string | undefined
  terms: string | undefined
  signedAt: string | undefined
  acceptedByName: string | undefined
  clientName: string
  organizationName: string
  lines: {
    id: string
    name: string
    description: string | undefined
    unitPriceCents: number
    quantity: number
    unit: CatalogUnit
  }[]
}

export type SharedContractView =
  { state: 'missing' } | { state: 'open' | 'accepted' | 'withdrawn'; contract: SharedContract }

export type AcceptContractResult = { ok: true } | { ok: false; message: string }

export interface AcceptanceRequest {
  ip: string | null
  userAgent: string | null
}

const ACCEPTED_STATUSES: readonly string[] = ['active', 'paused', 'completed']

const LINE_SELECT = {
  orderBy: { sortOrder: 'asc' },
  select: {
    id: true,
    name: true,
    description: true,
    unitPriceCents: true,
    quantity: true,
    unit: true,
  },
} as const

function iso(value: Date | null) {
  return value ? value.toISOString() : undefined
}

export async function loadSharedContract(
  contractId: string,
  signature: string,
): Promise<SharedContractView> {
  const contract = await db.contract.findFirst({
    where: { id: contractId, archivedAt: null },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      reference: true,
      title: true,
      status: true,
      billingCycle: true,
      subtotalCents: true,
      startDate: true,
      endDate: true,
      terms: true,
      signedAt: true,
      sharedAt: true,
      acceptedByName: true,
      lines: LINE_SELECT,
    },
  })

  // A wrong id and a wrong signature answer alike, so a link cannot probe which contracts exist.
  if (!contract || !verifyContractLink(contract.id, contract.sharedAt, signature)) {
    return { state: 'missing' }
  }

  const [client, organization] = await Promise.all([
    db.client.findFirst({ where: { id: contract.clientId }, select: { name: true } }),
    db.organization.findUnique({
      where: { id: contract.organizationId },
      select: { name: true },
    }),
  ])

  const status = contract.status as ContractStatus

  return {
    state:
      status === 'sent' ? 'open' : ACCEPTED_STATUSES.includes(status) ? 'accepted' : 'withdrawn',
    contract: {
      id: contract.id,
      reference: contract.reference,
      title: contract.title,
      status,
      billingCycle: contract.billingCycle as BillingCycle,
      subtotalCents: contract.subtotalCents,
      startDate: iso(contract.startDate),
      endDate: iso(contract.endDate),
      terms: contract.terms ?? undefined,
      signedAt: iso(contract.signedAt),
      acceptedByName: contract.acceptedByName ?? undefined,
      clientName: client?.name ?? 'Client',
      organizationName: organization?.name ?? 'IHP Plus',
      lines: contract.lines.map((line) => ({
        ...line,
        description: line.description ?? undefined,
        unit: line.unit as CatalogUnit,
      })),
    },
  }
}

/** Records the first time the client opened their link, for the manager's drawer. */
export async function markSharedContractViewed(contractId: string) {
  await db.contract.updateMany({
    where: { id: contractId, status: 'sent', viewedAt: null },
    data: { viewedAt: new Date() },
  })
}

export async function acceptSharedContract(
  input: unknown,
  request: AcceptanceRequest,
  now = new Date(),
): Promise<AcceptContractResult> {
  const parsed = contractAcceptanceSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Check the form and try again.',
    }
  }
  const values = parsed.data

  const contract = await db.contract.findFirst({
    where: { id: values.contractId, archivedAt: null },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      ownerId: true,
      reference: true,
      title: true,
      status: true,
      billingCycle: true,
      startDate: true,
      endDate: true,
      updatedAt: true,
      sharedAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      lines: LINE_SELECT,
    },
  })

  if (!contract || !verifyContractLink(contract.id, contract.sharedAt, values.signature)) {
    return { ok: false, message: 'This link is no longer valid. Ask your contact for a new one.' }
  }

  if (contract.status !== 'sent') {
    return {
      ok: false,
      message: ACCEPTED_STATUSES.includes(contract.status)
        ? 'This contract has already been accepted.'
        : 'This contract is no longer open for acceptance. Ask your contact where it stands.',
    }
  }

  let attachment: Awaited<ReturnType<typeof syncBilling>>
  try {
    attachment = await syncBilling(contract, 'active', now)
  } catch (error) {
    console.error(
      `[contracts] billing refused the client acceptance of ${contract.reference}`,
      error,
    )
    // Billing detail is the organization's to fix, not something the client can act on.
    return {
      ok: false,
      message:
        'We could not record your acceptance just now, and nothing was changed. Try again in a few minutes.',
    }
  }

  // Guarded on the publication it was accepted from, so a double submit cannot land twice.
  const accepted = await db.contract.updateMany({
    where: { id: contract.id, status: 'sent', sharedAt: contract.sharedAt },
    data: {
      ...attachment,
      status: 'active',
      signedAt: now,
      acceptedByName: values.fullName,
      acceptedIp: request.ip?.slice(0, 64) ?? null,
      acceptedUserAgent: request.userAgent?.slice(0, 500) ?? null,
    },
  })

  if (accepted.count === 0) {
    return {
      ok: false,
      message:
        'This contract changed while you were accepting it. Reload the page to see where it stands.',
    }
  }

  await notifyOwner(contract, values.fullName)
  return { ok: true }
}

async function notifyOwner(
  contract: { ownerId: string | null; clientId: string; reference: string },
  acceptedByName: string,
) {
  if (!contract.ownerId) return

  const [owner, client] = await Promise.all([
    db.user.findUnique({ where: { id: contract.ownerId }, select: { email: true } }),
    db.client.findFirst({ where: { id: contract.clientId }, select: { name: true } }),
  ])
  if (!owner) return

  void sendEmail({
    to: owner.email,
    ...contractAcceptedTemplate({
      clientName: client?.name ?? 'The client',
      reference: contract.reference,
      acceptedByName,
      url: portalUrl(clientTab('contracts')),
    }),
  })
}

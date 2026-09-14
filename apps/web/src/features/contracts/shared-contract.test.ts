import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  contract: { findFirst: vi.fn(), updateMany: vi.fn() },
  client: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}))

const billing = vi.hoisted(() => ({ syncBilling: vi.fn() }))
const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  contractAcceptedTemplate: vi.fn(),
  portalUrl: vi.fn(),
}))
const link = vi.hoisted(() => ({ verifyContractLink: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/features/billing/contract-billing', () => billing)
vi.mock('@/lib/email', () => email)
vi.mock('./client-link', () => link)

const { acceptSharedContract, loadSharedContract } = await import('./shared-contract')

const SHARED_AT = new Date('2026-09-14T09:00:00.000Z')
const NOW = new Date('2026-09-15T10:00:00.000Z')
const REQUEST = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0' }

const SENT = {
  id: 'contract-1',
  organizationId: 'org-1',
  clientId: 'client-1',
  ownerId: 'user-2',
  reference: 'IHP-C-0007',
  title: 'Growth retainer',
  status: 'sent',
  billingCycle: 'monthly',
  subtotalCents: 250_000,
  startDate: null,
  endDate: null,
  terms: 'Net 30.',
  signedAt: null,
  sharedAt: SHARED_AT,
  acceptedByName: null,
  updatedAt: SHARED_AT,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  lines: [
    {
      id: 'line-1',
      name: 'Social management',
      description: null,
      unitPriceCents: 250_000,
      quantity: 1,
      unit: 'month',
    },
  ],
}

const ACCEPTANCE = {
  contractId: 'contract-1',
  signature: 'sig',
  fullName: 'Dana Reyes',
  agree: true,
}

beforeEach(() => {
  vi.resetAllMocks()
  prisma.contract.findFirst.mockResolvedValue(SENT)
  prisma.contract.updateMany.mockResolvedValue({ count: 1 })
  prisma.client.findFirst.mockResolvedValue({ name: 'Riverside Care Center' })
  prisma.organization.findUnique.mockResolvedValue({ name: 'Innovare Health Partners' })
  prisma.user.findUnique.mockResolvedValue({ email: 'owner@ihp.test' })
  link.verifyContractLink.mockReturnValue(true)
  email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
  billing.syncBilling.mockResolvedValue({
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
  })
  email.contractAcceptedTemplate.mockReturnValue({ subject: 'Accepted', html: '<p/>', text: '' })
})

describe('loadSharedContract', () => {
  it('shows an open contract with the names a client recognises', async () => {
    const view = await loadSharedContract('contract-1', 'sig')

    expect(view).toMatchObject({
      state: 'open',
      contract: {
        reference: 'IHP-C-0007',
        clientName: 'Riverside Care Center',
        organizationName: 'Innovare Health Partners',
        terms: 'Net 30.',
        lines: [{ name: 'Social management', unit: 'month' }],
      },
    })
    expect(link.verifyContractLink).toHaveBeenCalledWith('contract-1', SHARED_AT, 'sig')
  })

  it('answers a wrong signature exactly like a contract that does not exist', async () => {
    link.verifyContractLink.mockReturnValue(false)
    expect(await loadSharedContract('contract-1', 'forged')).toEqual({ state: 'missing' })

    prisma.contract.findFirst.mockResolvedValue(null)
    expect(await loadSharedContract('contract-9', 'sig')).toEqual({ state: 'missing' })

    expect(prisma.client.findFirst).not.toHaveBeenCalled()
  })

  it('shows an agreed contract as accepted, with who signed it', async () => {
    prisma.contract.findFirst.mockResolvedValue({
      ...SENT,
      status: 'active',
      signedAt: NOW,
      acceptedByName: 'Dana Reyes',
    })

    expect(await loadSharedContract('contract-1', 'sig')).toMatchObject({
      state: 'accepted',
      contract: { acceptedByName: 'Dana Reyes', signedAt: NOW.toISOString() },
    })
  })

  it('shows a cancelled contract as withdrawn', async () => {
    prisma.contract.findFirst.mockResolvedValue({ ...SENT, status: 'cancelled' })

    expect(await loadSharedContract('contract-1', 'sig')).toMatchObject({ state: 'withdrawn' })
  })
})

describe('acceptSharedContract', () => {
  it('records who accepted and from where, starts billing, and tells the owner', async () => {
    expect(await acceptSharedContract(ACCEPTANCE, REQUEST, NOW)).toEqual({ ok: true })

    expect(billing.syncBilling).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'contract-1', status: 'sent' }),
      'active',
      NOW,
    )
    expect(prisma.contract.updateMany).toHaveBeenCalledWith({
      where: { id: 'contract-1', status: 'sent', sharedAt: SHARED_AT },
      data: {
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        signedAt: NOW,
        acceptedByName: 'Dana Reyes',
        acceptedIp: '203.0.113.7',
        acceptedUserAgent: 'Mozilla/5.0',
      },
    })
    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@ihp.test' }))
    expect(email.contractAcceptedTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedByName: 'Dana Reyes',
        url: 'https://portal.ihp.test/app/clients?tab=contracts',
      }),
    )
  })

  it('refuses without a typed name or the agreement box, before reading anything', async () => {
    expect(await acceptSharedContract({ ...ACCEPTANCE, fullName: ' ' }, REQUEST, NOW)).toEqual({
      ok: false,
      message: 'Type your full name to accept',
    })
    expect(await acceptSharedContract({ ...ACCEPTANCE, agree: false }, REQUEST, NOW)).toEqual({
      ok: false,
      message: 'Tick the box to confirm you agree',
    })
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('refuses a link that no longer matches the contract', async () => {
    link.verifyContractLink.mockReturnValue(false)

    const result = await acceptSharedContract(ACCEPTANCE, REQUEST, NOW)

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('no longer valid') })
    expect(billing.syncBilling).not.toHaveBeenCalled()
  })

  it('says so when the contract was already accepted, without billing again', async () => {
    prisma.contract.findFirst.mockResolvedValue({ ...SENT, status: 'active' })

    expect(await acceptSharedContract(ACCEPTANCE, REQUEST, NOW)).toEqual({
      ok: false,
      message: 'This contract has already been accepted.',
    })
    expect(billing.syncBilling).not.toHaveBeenCalled()
  })

  it('keeps billing detail from the client and changes nothing when Stripe refuses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    billing.syncBilling.mockRejectedValue(new Error('Stripe said: No such customer'))

    const result = await acceptSharedContract(ACCEPTANCE, REQUEST, NOW)

    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.message).not.toContain('Stripe')
    expect(prisma.contract.updateMany).not.toHaveBeenCalled()
  })

  it('does not accept twice when two submissions race', async () => {
    prisma.contract.updateMany.mockResolvedValue({ count: 0 })

    const result = await acceptSharedContract(ACCEPTANCE, REQUEST, NOW)

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('changed while') })
    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})

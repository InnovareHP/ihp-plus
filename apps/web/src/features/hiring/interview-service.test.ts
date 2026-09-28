import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  interview: { updateMany: vi.fn(), create: vi.fn() },
  applicationEvent: { create: vi.fn() },
}))
const prisma = vi.hoisted(() => ({
  jobApplication: { findFirst: vi.fn() },
  member: { count: vi.fn(), findMany: vi.fn() },
  interview: { update: vi.fn() },
  applicationEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}))
const access = vi.hoisted(() => ({ requireHiringCaller: vi.fn() }))
const notify = vi.hoisted(() => ({
  notifyInterviewOffered: vi.fn(),
  notifyInterviewCancelled: vi.fn(),
}))
const interviews = vi.hoisted(() => ({ loadInterviewContext: vi.fn() }))
const pipeline = vi.hoisted(() => ({ loadApplication: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./interview-notifications', () => notify)
vi.mock('./interviews', () => interviews)
vi.mock('./pipeline-service', () => pipeline)

const { cancelInterview, offerInterview } = await import('./interview-service')

const HOUR = 60 * 60 * 1000
const later = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString()

const OFFER = {
  applicationId: 'app-1',
  format: 'video' as const,
  location: '',
  note: '',
  durationMinutes: 45,
  interviewerIds: ['user-hr', 'user-lead'],
  starts: [later(72), later(48)],
}

async function errorOf(operation: () => Promise<unknown>) {
  return operation().then(
    () => undefined,
    (thrown: unknown) => ConnectError.from(thrown),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  access.requireHiringCaller.mockResolvedValue({
    userId: 'user-hr',
    name: 'Rita',
    organizationId: 'org-1',
    isAdmin: false,
  })
  prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1', status: 'active' })
  prisma.member.count.mockResolvedValue(2)
  tx.interview.create.mockResolvedValue({ id: 'int-1' })
  prisma.$transaction.mockImplementation((work: unknown) =>
    typeof work === 'function' ? work(tx) : Promise.all(work as Promise<unknown>[]),
  )
  interviews.loadInterviewContext.mockResolvedValue({ row: {}, context: { interviewId: 'int-1' } })
})

describe('offering an interview', () => {
  it('stores the times soonest first, replaces an offer still waiting, and emails the applicant', async () => {
    await offerInterview(OFFER)

    expect(tx.interview.updateMany).toHaveBeenCalledWith({
      where: { applicationId: 'app-1', status: { in: ['offered', 'reschedule_requested'] } },
      data: { status: 'cancelled' },
    })
    const data = tx.interview.create.mock.calls[0]?.[0].data
    const starts = data.slots.create.map((slot: { start: Date }) => slot.start.toISOString())
    expect(starts).toEqual([OFFER.starts[1], OFFER.starts[0]])
    // Each slot ends when its length says, not whenever the client claimed.
    const [first] = data.slots.create
    expect(first.end.getTime() - first.start.getTime()).toBe(45 * 60 * 1000)
    expect(notify.notifyInterviewOffered).toHaveBeenCalledWith({ interviewId: 'int-1' })
  })

  it('refuses a time already past, and the same time twice', async () => {
    expect(
      (await errorOf(() => offerInterview({ ...OFFER, starts: [later(-1)] })))?.rawMessage,
    ).toBe('Every time offered has to be in the future.')

    const twice = later(24)
    expect(
      (await errorOf(() => offerInterview({ ...OFFER, starts: [twice, twice] })))?.rawMessage,
    ).toBe('The same time is offered twice.')
    expect(tx.interview.create).not.toHaveBeenCalled()
  })

  it('refuses an interviewer from outside the organization', async () => {
    prisma.member.count.mockResolvedValue(1)

    expect((await errorOf(() => offerInterview(OFFER)))?.code).toBe(Code.NotFound)
  })

  it('refuses to interview someone already decided', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1', status: 'rejected' })

    expect((await errorOf(() => offerInterview(OFFER)))?.code).toBe(Code.FailedPrecondition)
  })
})

describe('cancelling', () => {
  const BOOKED = {
    id: 'int-1',
    organizationId: 'org-1',
    applicationId: 'app-1',
    status: 'booked',
    sequence: 1,
    bookedStart: new Date('2026-10-14T02:00:00.000Z'),
    bookedEnd: new Date('2026-10-14T02:45:00.000Z'),
    applicantTimeZone: 'America/Detroit',
    calendarEventId: null,
  }

  it('takes a booked interview out of everyone’s calendar with a newer sequence', async () => {
    interviews.loadInterviewContext.mockResolvedValue({
      row: BOOKED,
      context: { interviewId: 'int-1', sequence: 1, timeZone: 'Asia/Manila' },
    })

    await cancelInterview('int-1')

    expect(prisma.interview.update).toHaveBeenCalledWith({
      where: { id: 'int-1' },
      data: { status: 'cancelled', sequence: 2 },
    })
    expect(notify.notifyInterviewCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 2 }),
      expect.objectContaining({ applicantTimeZone: 'America/Detroit' }),
      { attachInvite: true },
    )
  })

  it('withdraws an offer nobody picked without emailing anyone', async () => {
    interviews.loadInterviewContext.mockResolvedValue({
      row: { ...BOOKED, status: 'offered', bookedStart: null, bookedEnd: null },
      context: { interviewId: 'int-1', sequence: 1 },
    })

    await cancelInterview('int-1')

    expect(notify.notifyInterviewCancelled).not.toHaveBeenCalled()
  })

  it('only reaches interviews in the caller’s organization', async () => {
    interviews.loadInterviewContext.mockResolvedValue({
      row: { ...BOOKED, organizationId: 'org-2' },
      context: {},
    })

    expect((await errorOf(() => cancelInterview('int-1')))?.code).toBe(Code.NotFound)
    expect(prisma.interview.update).not.toHaveBeenCalled()
  })
})

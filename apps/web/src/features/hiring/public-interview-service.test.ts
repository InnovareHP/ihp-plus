import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  interviewSlot: { findFirst: vi.fn() },
  interview: { updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  applicationEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}))
const link = vi.hoisted(() => ({ findByLink: vi.fn() }))
const notify = vi.hoisted(() => ({
  notifyInterviewBooked: vi.fn(),
  notifyInterviewCancelled: vi.fn(),
  notifyRescheduleRequested: vi.fn(),
}))
const interviews = vi.hoisted(() => ({
  INTERVIEW_INCLUDE: {},
  loadInterviewContext: vi.fn(),
  offerOf: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./public-service', () => link)
vi.mock('./interview-notifications', () => notify)
vi.mock('./interviews', () => interviews)

const { bookInterviewSlot, requestNewTimes } = await import('./public-interview-service')

const HOUR = 60 * 60 * 1000
const START = new Date(Date.now() + 48 * HOUR)
const END = new Date(START.getTime() + 45 * 60 * 1000)

const BOOKING = {
  applicationId: 'app-1',
  signature: 'sig',
  interviewId: 'int-1',
  slotId: 'slot-1',
  timeZone: 'America/Detroit',
}

beforeEach(() => {
  vi.clearAllMocks()
  link.findByLink.mockResolvedValue({ id: 'app-1', status: 'active' })
  prisma.interviewSlot.findFirst.mockResolvedValue({ id: 'slot-1', start: START, end: END })
  prisma.interview.updateMany.mockResolvedValue({ count: 1 })
  prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  )
  interviews.loadInterviewContext.mockResolvedValue({
    row: { calendarEventId: null },
    context: { interviewId: 'int-1', timeZone: 'Asia/Manila' },
  })
})

describe('booking a time', () => {
  it('books the slot in the zone they read it in and sends everyone the invite', async () => {
    expect(await bookInterviewSlot(BOOKING)).toEqual({ ok: true, data: undefined })

    expect(prisma.interview.updateMany).toHaveBeenCalledWith({
      where: { id: 'int-1', status: 'offered' },
      data: expect.objectContaining({
        status: 'booked',
        bookedStart: START,
        bookedEnd: END,
        applicantTimeZone: 'America/Detroit',
      }),
    })
    expect(notify.notifyInterviewBooked).toHaveBeenCalledWith(
      expect.objectContaining({ interviewId: 'int-1' }),
      { start: START, end: END, applicantTimeZone: 'America/Detroit' },
      { attachInvite: true },
    )
  })

  it('refuses a link that does not verify', async () => {
    link.findByLink.mockResolvedValue(null)

    expect(await bookInterviewSlot(BOOKING)).toEqual({
      ok: false,
      message: 'That link is not valid.',
    })
    expect(prisma.interview.updateMany).not.toHaveBeenCalled()
  })

  it('refuses a slot less than an hour away', async () => {
    prisma.interviewSlot.findFirst.mockResolvedValue({
      id: 'slot-1',
      start: new Date(Date.now() + 10 * 60 * 1000),
      end: END,
    })

    expect((await bookInterviewSlot(BOOKING)).ok).toBe(false)
    expect(prisma.interview.updateMany).not.toHaveBeenCalled()
  })

  it('loses gracefully to a second tab that booked first', async () => {
    prisma.interview.updateMany.mockResolvedValue({ count: 0 })

    expect(await bookInterviewSlot(BOOKING)).toEqual({
      ok: false,
      message: 'This interview is already booked or was withdrawn.',
    })
    expect(notify.notifyInterviewBooked).not.toHaveBeenCalled()
  })

  it('ignores a zone name the runtime does not know, falling back to the organization’s', async () => {
    await bookInterviewSlot({ ...BOOKING, timeZone: 'Mars/Olympus' })

    expect(prisma.interview.updateMany.mock.calls[0]?.[0].data.applicantTimeZone).toBeUndefined()
    expect(notify.notifyInterviewBooked.mock.calls[0]?.[1].applicantTimeZone).toBe('Asia/Manila')
  })
})

describe('asking for other times', () => {
  it('takes a booking back out of calendars and tells HR', async () => {
    interviews.loadInterviewContext.mockResolvedValue({
      row: {
        id: 'int-1',
        applicationId: 'app-1',
        status: 'booked',
        sequence: 2,
        bookedStart: START,
        bookedEnd: END,
        applicantTimeZone: 'America/Detroit',
        calendarEventId: null,
      },
      context: { interviewId: 'int-1', timeZone: 'Asia/Manila', sequence: 2 },
    })

    const result = await requestNewTimes({
      applicationId: 'app-1',
      signature: 'sig',
      interviewId: 'int-1',
    })

    expect(result.ok).toBe(true)
    expect(prisma.interview.update).toHaveBeenCalledWith({
      where: { id: 'int-1' },
      data: { status: 'reschedule_requested', sequence: 3 },
    })
    expect(notify.notifyInterviewCancelled).toHaveBeenCalled()
    expect(notify.notifyRescheduleRequested).toHaveBeenCalled()
  })

  it('only acts on an interview belonging to the linked application', async () => {
    interviews.loadInterviewContext.mockResolvedValue({
      row: { id: 'int-1', applicationId: 'app-other', status: 'offered' },
      context: {},
    })

    const result = await requestNewTimes({
      applicationId: 'app-1',
      signature: 'sig',
      interviewId: 'int-1',
    })

    expect(result.ok).toBe(false)
    expect(prisma.interview.update).not.toHaveBeenCalled()
  })
})

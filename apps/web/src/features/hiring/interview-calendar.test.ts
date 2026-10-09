import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const graph = vi.hoisted(() => ({
  isCalendarConfigured: vi.fn(),
  createCalendarEvent: vi.fn(),
  cancelCalendarEvent: vi.fn(),
  getAvailability: vi.fn(),
}))
const prisma = vi.hoisted(() => ({
  hiringSettings: { findUnique: vi.fn() },
  member: { findMany: vi.fn() },
}))

vi.mock('@ihp/graph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ihp/graph')>()),
  ...graph,
}))
vi.mock('@ihp/db', () => ({ db: prisma }))

const { calendarFailure, putInCalendar, suggestInterviewTimes, takeOutOfCalendar } =
  await import('./interview-calendar')
const { GraphError } = await import('@ihp/graph')
const { Code } = await import('@ihp/rpc')

const CONTEXT = {
  interviewId: 'int-1',
  applicationId: 'app-1',
  organizationId: 'org-1',
  organizationName: 'IHP+',
  timeZone: 'Asia/Manila',
  applicant: { fullName: 'Grace Hopper', email: 'grace@example.com', phone: '' },
  postingTitle: 'Registered nurse',
  format: 'video' as const,
  location: '',
  note: 'Bring <your> licence.',
  joinUrl: undefined,
  interviewers: [{ userId: 'user-hr', name: 'Rita', email: 'rita@ihp.test' }],
  sequence: 3,
  statusUrl: 'https://ihp.test/status',
}

const BOOKED = {
  start: new Date('2026-10-14T02:00:00.000Z'),
  end: new Date('2026-10-14T02:45:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  graph.isCalendarConfigured.mockReturnValue(true)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('putInCalendar', () => {
  it('books a Teams call for a video interview with no link of HR’s own', async () => {
    graph.createCalendarEvent.mockResolvedValue({ id: 'event-1', joinUrl: 'https://teams.test/j' })

    expect(await putInCalendar(CONTEXT, BOOKED)).toEqual({
      id: 'event-1',
      joinUrl: 'https://teams.test/j',
    })
    const event = graph.createCalendarEvent.mock.calls[0]?.[0]
    expect(event).toMatchObject({
      online: true,
      transactionId: 'interview-int-1-3',
      attendees: [
        { name: 'Grace Hopper', email: 'grace@example.com' },
        { name: 'Rita', email: 'rita@ihp.test' },
      ],
    })
    // The note goes into HTML, so it is escaped rather than trusted.
    expect(event.body).toContain('Bring &lt;your&gt; licence.')
  })

  it('keeps HR’s own video link instead of adding Teams', async () => {
    graph.createCalendarEvent.mockResolvedValue({ id: 'event-1', joinUrl: undefined })

    await putInCalendar({ ...CONTEXT, location: 'https://zoom.test/j/1' }, BOOKED)

    expect(graph.createCalendarEvent.mock.calls[0]?.[0].online).toBe(false)
  })

  it('answers null, for the .ics fallback, when Graph is off or refuses', async () => {
    graph.isCalendarConfigured.mockReturnValue(false)
    expect(await putInCalendar(CONTEXT, BOOKED)).toBeNull()

    graph.isCalendarConfigured.mockReturnValue(true)
    graph.createCalendarEvent.mockRejectedValue(new Error('Access denied'))
    expect(await putInCalendar(CONTEXT, BOOKED)).toBeNull()
  })
})

describe('takeOutOfCalendar', () => {
  it('reports whether Outlook took care of telling everyone', async () => {
    graph.cancelCalendarEvent.mockResolvedValue(undefined)
    expect(await takeOutOfCalendar('event-1', 'Off.')).toBe(true)

    graph.cancelCalendarEvent.mockRejectedValue(new Error('gone'))
    expect(await takeOutOfCalendar('event-1', 'Off.')).toBe(false)
  })
})

describe('suggestInterviewTimes', () => {
  beforeEach(() => {
    prisma.hiringSettings.findUnique.mockResolvedValue({ timeZone: 'Asia/Manila' })
    prisma.member.findMany.mockResolvedValue([{ user: { email: 'rita@ihp.test' } }])
  })

  it('says it has no calendar when Graph is not set up', async () => {
    graph.isCalendarConfigured.mockReturnValue(false)

    expect(
      await suggestInterviewTimes({
        organizationId: 'org-1',
        interviewerIds: ['user-hr'],
        durationMinutes: 60,
        fromDate: '2026-10-12',
        toDate: '2026-10-16',
      }),
    ).toEqual({ starts: [], fromCalendar: false })
  })

  it('offers weekday times inside working hours in the organization’s zone, a few a day', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00.000Z') })
    // Free around the clock, so only the working-hours, weekday and per-day rules decide.
    graph.getAvailability.mockResolvedValue([{ email: 'rita@ihp.test', view: '0'.repeat(48 * 7) }])

    const { starts, fromCalendar } = await suggestInterviewTimes({
      organizationId: 'org-1',
      interviewerIds: ['user-hr'],
      durationMinutes: 60,
      // Saturday 10 Oct to Friday 16 Oct, Manila.
      fromDate: '2026-10-10',
      toDate: '2026-10-16',
    })

    expect(fromCalendar).toBe(true)
    const local = starts.map((start) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(start),
    )
    // Monday comes first: the weekend is skipped, and each day starts at 09:00.
    expect(local.slice(0, 4)).toEqual(['Mon 09:00', 'Mon 09:30', 'Mon 10:00', 'Tue 09:00'])
    expect(starts).toHaveLength(12)
  })
})

describe('when Outlook refuses', () => {
  const REQUEST = {
    organizationId: 'org-1',
    interviewerIds: ['user-hr'],
    durationMinutes: 60,
    fromDate: '2026-10-12',
    toDate: '2026-10-16',
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    graph.isCalendarConfigured.mockReturnValue(true)
    prisma.hiringSettings.findUnique.mockResolvedValue({ timeZone: 'Asia/Manila' })
    prisma.member.findMany.mockResolvedValue([{ user: { email: 'rita@ihp.test' } }])
  })

  it('names the missing permission instead of failing with a bare 500', async () => {
    graph.getAvailability.mockRejectedValue(
      new GraphError(403, 'ErrorAccessDenied', 'Access is denied.'),
    )

    await expect(suggestInterviewTimes(REQUEST)).rejects.toMatchObject({
      code: Code.PermissionDenied,
      rawMessage: expect.stringMatching(/Calendars.ReadWrite/),
    })
  })

  it('tells a wrong secret, a wrong tenant and a missing mailbox apart', () => {
    expect(
      calendarFailure(
        new Error('Could not get a Graph token: AADSTS7000215: Invalid client secret'),
      ).rawMessage,
    ).toMatch(/client secret/)
    expect(
      calendarFailure(new Error('Could not get a Graph token: AADSTS700016: Application not found'))
        .rawMessage,
    ).toMatch(/MICROSOFT_TENANT_ID/)
    expect(
      calendarFailure(new GraphError(404, 'ErrorInvalidUser', 'Not found')).rawMessage,
    ).toMatch(/MICROSOFT_CALENDAR_MAILBOX/)
    expect(calendarFailure(new Error('socket hang up')).code).toBe(Code.Unavailable)
  })
})

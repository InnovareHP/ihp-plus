import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelCalendarEvent,
  commonFreeStarts,
  createCalendarEvent,
  getAvailability,
  getCalendarTimeZone,
  ianaTimeZone,
  isCalendarConfigured,
} from './calendar'
import { resetTokenCache } from './token'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

function graphCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith('https://graph.'))
}

beforeEach(() => {
  process.env.MICROSOFT_TENANT_ID = 'tenant-1'
  process.env.MICROSOFT_CLIENT_ID = 'signin-client'
  process.env.MICROSOFT_CLIENT_SECRET = 'signin-secret'
  process.env.MICROSOFT_CALENDAR_MAILBOX = 'careers@ihp.test'
  delete process.env.GRAPH_TENANT_ID
  delete process.env.GRAPH_CLIENT_ID
  delete process.env.GRAPH_CLIENT_SECRET
  resetTokenCache()
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      String(url).includes('login.microsoftonline')
        ? jsonResponse({ access_token: 'token-1', expires_in: 3600 })
        : jsonResponse({}),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
})

describe('calendar configuration', () => {
  it('runs on the Microsoft sign-in app alone, with no GRAPH_ variables set', () => {
    expect(isCalendarConfigured()).toBe(true)
  })

  it('needs the shared mailbox', () => {
    delete process.env.MICROSOFT_CALENDAR_MAILBOX
    expect(isCalendarConfigured()).toBe(false)
  })

  it('refuses the multi-tenant "common", which cannot issue an app-only token', () => {
    process.env.MICROSOFT_TENANT_ID = 'common'
    expect(isCalendarConfigured()).toBe(false)
  })

  it('asks for its token as the sign-in app', async () => {
    await getAvailability({
      emails: ['rita@ihp.test'],
      start: new Date('2030-10-14T00:00:00.000Z'),
      end: new Date('2030-10-15T00:00:00.000Z'),
      intervalMinutes: 30,
    }).catch(() => undefined)

    const tokenCall = fetchMock.mock.calls.find(([url]) => String(url).includes('login.'))
    expect(String(tokenCall?.[0])).toContain('/tenant-1/')
    expect(String(tokenCall?.[1]?.body)).toContain('client_id=signin-client')
  })
})

describe('createCalendarEvent', () => {
  it('books a Teams meeting in the shared mailbox, in UTC, and hands back the join link', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('login.microsoftonline')
          ? jsonResponse({ access_token: 'token-1', expires_in: 3600 })
          : jsonResponse({ id: 'event-1', onlineMeeting: { joinUrl: 'https://teams.test/j/1' } }),
      ),
    )

    const created = await createCalendarEvent({
      subject: 'Interview: Registered nurse, Grace Hopper',
      body: '<p>Hello</p>',
      start: new Date('2026-10-14T02:00:00.000Z'),
      end: new Date('2026-10-14T02:45:00.000Z'),
      location: '',
      attendees: [{ name: 'Grace Hopper', email: 'grace@example.com' }],
      online: true,
      transactionId: 'interview-int-1-3',
    })

    expect(created).toEqual({ id: 'event-1', joinUrl: 'https://teams.test/j/1' })
    const [url, init] = graphCalls()[0] ?? []
    expect(url).toBe('https://graph.microsoft.com/v1.0/users/careers%40ihp.test/events')
    const body = JSON.parse(String(init.body))
    expect(body.start).toEqual({ dateTime: '2026-10-14T02:00:00.000', timeZone: 'UTC' })
    expect(body).toMatchObject({
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      transactionId: 'interview-int-1-3',
      attendees: [
        { emailAddress: { address: 'grace@example.com', name: 'Grace Hopper' }, type: 'required' },
      ],
    })
  })

  it('leaves Teams out of an in-person meeting', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('login.microsoftonline')
          ? jsonResponse({ access_token: 'token-1', expires_in: 3600 })
          : jsonResponse({ id: 'event-2' }),
      ),
    )

    const created = await createCalendarEvent({
      subject: 'Interview',
      body: '',
      start: new Date('2026-10-14T02:00:00.000Z'),
      end: new Date('2026-10-14T02:45:00.000Z'),
      location: '12 Ayala Ave',
      attendees: [],
      online: false,
      transactionId: 't',
    })

    const body = JSON.parse(String(graphCalls()[0]?.[1].body))
    expect(body.onlineMeetingProvider).toBeUndefined()
    expect(body.location).toEqual({ displayName: '12 Ayala Ave' })
    expect(created.joinUrl).toBeUndefined()
  })
})

describe('cancelCalendarEvent', () => {
  it('cancels as the organizer so attendees are told', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('login.microsoftonline')
          ? jsonResponse({ access_token: 'token-1', expires_in: 3600 })
          : new Response(null, { status: 202 }),
      ),
    )

    await cancelCalendarEvent('event-1', 'The interview is off.')

    const [url, init] = graphCalls()[0] ?? []
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/users/careers%40ihp.test/events/event-1/cancel',
    )
    expect(JSON.parse(String(init.body))).toEqual({ comment: 'The interview is off.' })
  })
})

describe('free/busy', () => {
  it('treats a calendar Graph could not read as busy', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('login.microsoftonline')
          ? jsonResponse({ access_token: 'token-1', expires_in: 3600 })
          : jsonResponse({
              value: [
                { scheduleId: 'rita@ihp.test', availabilityView: '0020' },
                { scheduleId: 'ghost@ihp.test', error: { message: 'Not found' } },
              ],
            }),
      ),
    )

    const views = await getAvailability({
      emails: ['rita@ihp.test', 'ghost@ihp.test'],
      start: new Date('2026-10-14T01:00:00.000Z'),
      end: new Date('2026-10-14T03:00:00.000Z'),
      intervalMinutes: 30,
    })

    expect(views).toEqual([
      { email: 'rita@ihp.test', view: '0020' },
      { email: 'ghost@ihp.test', view: '' },
    ])
  })

  it('finds starts where everyone is free for the whole length', () => {
    const start = new Date('2026-10-14T00:00:00.000Z')
    const starts = commonFreeStarts({
      // Half-hour steps: a 60-minute interview needs two free steps in a row from both people.
      views: ['0000200', '0200000'],
      start,
      intervalMinutes: 30,
      durationMinutes: 60,
      accept: () => true,
      limit: 10,
    })

    expect(starts.map((date) => date.toISOString())).toEqual([
      '2026-10-14T01:00:00.000Z',
      '2026-10-14T02:30:00.000Z',
    ])
  })

  it('keeps only the starts the caller accepts, up to the limit', () => {
    const starts = commonFreeStarts({
      views: ['0000000000'],
      start: new Date('2026-10-14T00:00:00.000Z'),
      intervalMinutes: 30,
      durationMinutes: 30,
      accept: (date) => date.getUTCMinutes() === 0,
      limit: 2,
    })

    expect(starts.map((date) => date.toISOString())).toEqual([
      '2026-10-14T00:00:00.000Z',
      '2026-10-14T01:00:00.000Z',
    ])
  })
})

describe('getCalendarTimeZone', () => {
  it('reads the mailbox’s own zone from its working hours, as an IANA name', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('login.microsoftonline')
          ? jsonResponse({ access_token: 'token-1', expires_in: 3600 })
          : jsonResponse({
              value: [{ workingHours: { timeZone: { name: 'Eastern Standard Time' } } }],
            }),
      ),
    )

    await expect(getCalendarTimeZone()).resolves.toBe('America/New_York')
    const [url, init] = graphCalls()[0] ?? []
    expect(String(url)).toContain('/users/careers%40ihp.test/calendar/getSchedule')
    expect(JSON.parse(String(init?.body)).schedules).toEqual(['careers@ihp.test'])
  })

  it('keeps an IANA name and drops one nobody knows', () => {
    expect(ianaTimeZone('Asia/Manila')).toBe('Asia/Manila')
    expect(ianaTimeZone('Customized Time Zone')).toBeUndefined()
  })
})

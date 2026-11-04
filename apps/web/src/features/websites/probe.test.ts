import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:dns/promises', () => {
  const lookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }])
  return { lookup, default: { lookup } }
})

import { probeWebsite } from './probe'

// Each answer is [status, ms it took]; the clock jumps by that much while the fetch runs.
function answers(...replies: [number, number][]) {
  let clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  const fetchMock = vi.fn(async () => {
    const [status, ms] = replies.shift() ?? [200, 10]
    clock += ms
    return new Response(null, { status })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('probeWebsite', () => {
  it('takes one look at a site that answers in time', async () => {
    const fetchMock = answers([200, 800])

    expect(await probeWebsite('https://fast.example')).toEqual({
      httpStatus: 200,
      responseMs: 800,
      error: '',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tries a slow site again and keeps the quick second answer', async () => {
    const fetchMock = answers([200, 6700], [200, 900])

    expect(await probeWebsite('https://sleepy.example')).toMatchObject({
      httpStatus: 200,
      responseMs: 900,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the first slow answer when the site is slow both times', async () => {
    answers([200, 6700], [200, 7200])

    expect(await probeWebsite('https://slow.example')).toMatchObject({ responseMs: 6700 })
  })

  it('keeps the first slow answer when the second try fails', async () => {
    answers([200, 6700], [503, 100])

    expect(await probeWebsite('https://flaky.example')).toMatchObject({
      httpStatus: 200,
      responseMs: 6700,
    })
  })

  it('does not retry a site that is down', async () => {
    const fetchMock = answers([500, 100])

    expect(await probeWebsite('https://down.example')).toMatchObject({ httpStatus: 500 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

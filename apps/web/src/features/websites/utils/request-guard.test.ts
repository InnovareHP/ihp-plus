import { describe, expect, it, vi } from 'vitest'
import { requestAllowed } from './request-guard'

const publicOnly = vi.fn(async (hostname: string) => hostname !== 'intranet.local')

describe('requestAllowed', () => {
  it('lets the page load from public hosts', async () => {
    expect(await requestAllowed('https://cdn.example/app.js', 'script', publicOnly)).toBe(true)
    expect(publicOnly).toHaveBeenCalledWith('cdn.example')
  })

  it('blocks anything that resolves into our own network', async () => {
    expect(await requestAllowed('http://intranet.local/admin', 'fetch', publicOnly)).toBe(false)
  })

  it('treats a host that cannot be resolved as blocked', async () => {
    const failing = vi.fn(async () => {
      throw new Error('ENOTFOUND')
    })

    expect(await requestAllowed('https://nowhere.example/', 'document', failing)).toBe(false)
  })

  it('refuses schemes a website has no business opening', async () => {
    expect(await requestAllowed('file:///etc/passwd', 'document', publicOnly)).toBe(false)
    expect(await requestAllowed('ftp://files.example/x', 'other', publicOnly)).toBe(false)
    expect(await requestAllowed('not a url', 'other', publicOnly)).toBe(false)
  })

  it('allows inline content without a lookup', async () => {
    publicOnly.mockClear()

    expect(await requestAllowed('data:image/png;base64,AAAA', 'image', publicOnly)).toBe(true)
    expect(publicOnly).not.toHaveBeenCalled()
  })

  it('skips video and streams, which a still picture does not need', async () => {
    expect(await requestAllowed('https://cdn.example/intro.mp4', 'media', publicOnly)).toBe(false)
    expect(await requestAllowed('https://cdn.example/live', 'eventsource', publicOnly)).toBe(false)
  })
})

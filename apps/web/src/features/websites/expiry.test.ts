import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const probe = vi.hoisted(() => ({ resolvesPublic: vi.fn(async () => true) }))
const tls = vi.hoisted(() => ({ connect: vi.fn() }))

vi.mock('./probe', () => probe)
vi.mock('node:tls', () => ({ ...tls, default: tls }))

const { expiryOf, forgetRegistries } = await import('./expiry')

const BOOTSTRAP = {
  services: [[['com', 'net'], ['https://rdap.verisign.com/com/v1/']]],
}

// The IANA list answers first, then the registry it names.
function registryAnswers(registry: () => Promise<Response>) {
  fetchMock.mockImplementation(async (url: string) =>
    url.includes('data.iana.org') ? new Response(JSON.stringify(BOOTSTRAP)) : registry(),
  )
}

function socketWithCertificate(validTo: string | undefined) {
  const socket = Object.assign(new EventEmitter(), {
    setTimeout: vi.fn(),
    destroy: vi.fn(),
    getPeerCertificate: () => ({ valid_to: validTo }),
  })
  setTimeout(() => socket.emit('secureConnect'), 0)
  return socket
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  forgetRegistries()
  vi.stubGlobal('fetch', fetchMock)
  tls.connect.mockImplementation(() => socketWithCertificate('Jan  2 12:00:00 2027 GMT'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('expiryOf', () => {
  it('reads the registry’s expiry event and the certificate’s end date', async () => {
    registryAnswers(
      async () =>
        new Response(
          JSON.stringify({
            events: [
              { eventAction: 'registration', eventDate: '2010-03-14T00:00:00Z' },
              { eventAction: 'expiration', eventDate: '2027-03-14T00:00:00Z' },
            ],
          }),
        ),
    )

    expect(await expiryOf('https://www.cascadinggrace.com/')).toEqual({
      domain: '2027-03-14T00:00:00.000Z',
      ssl: '2027-01-02T12:00:00.000Z',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://rdap.verisign.com/com/v1/domain/cascadinggrace.com',
      expect.anything(),
    )
    expect(tls.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'www.cascadinggrace.com',
        servername: 'www.cascadinggrace.com',
      }),
    )
  })

  it('leaves out what it cannot read instead of failing the report', async () => {
    registryAnswers(async () => {
      throw new Error('offline')
    })
    tls.connect.mockImplementation(() => {
      const socket = socketWithCertificate(undefined)
      socket.removeAllListeners()
      setTimeout(() => socket.emit('error', new Error('refused')), 0)
      return socket
    })

    expect(await expiryOf('https://acme.example')).toEqual({ domain: undefined, ssl: undefined })
  })

  it('never opens a connection to an address inside our network', async () => {
    registryAnswers(async () => new Response('{}', { status: 404 }))
    probe.resolvesPublic.mockResolvedValue(false)

    expect((await expiryOf('https://intranet.acme.example')).ssl).toBeUndefined()
    expect(tls.connect).not.toHaveBeenCalled()
  })
})

describe('expiryOf, registries', () => {
  it('reads the registry list once and reuses it for the next site', async () => {
    registryAnswers(async () => new Response(JSON.stringify({ events: [] })))

    await expiryOf('https://one.com')
    await expiryOf('https://two.com')

    const listReads = fetchMock.mock.calls.filter(([url]) => String(url).includes('data.iana.org'))
    expect(listReads).toHaveLength(1)
  })

  it('says not available for an ending no registry serves over RDAP', async () => {
    registryAnswers(async () => new Response('{}'))

    expect((await expiryOf('https://acme.ph')).domain).toBeUndefined()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('acme.ph'))).toBe(false)
  })
})

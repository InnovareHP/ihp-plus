import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ses = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class {
    send = ses.send
  },
  SendEmailCommand: class {
    constructor(readonly input: unknown) {}
  },
}))

const { sendEmail } = await import('./send')

const MESSAGE = { to: 'grace@ihp.test', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' }

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ses.send.mockResolvedValue({})
    vi.stubEnv('EMAIL_FROM', 'portal@ihp.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('attaches the logo inline under the content id the layout points at', async () => {
    await expect(sendEmail(MESSAGE)).resolves.toEqual({ delivered: true })

    const input = ses.send.mock.calls[0]?.[0].input
    const [logo] = input.Content.Simple.Attachments
    expect(logo).toMatchObject({
      ContentId: 'ihp-logo',
      ContentDisposition: 'INLINE',
      ContentType: 'image/png',
    })
    // The PNG signature, so the bytes are the image rather than its base64 text.
    expect(Array.from(logo.RawContent.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('logs instead of sending when no sender is configured', async () => {
    vi.stubEnv('EMAIL_FROM', '')
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(sendEmail(MESSAGE)).resolves.toMatchObject({ delivered: false })
    expect(ses.send).not.toHaveBeenCalled()
  })
})

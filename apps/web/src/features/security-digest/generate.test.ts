import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    send = send
  },
  ConverseCommand: class {
    constructor(public input: unknown) {}
  },
}))

const { generateIssue, DigestAiError } = await import('./generate')

const ISSUE = {
  title: 'Spot a fake invoice',
  preheader: 'Three checks before you pay any invoice.',
  intro: ['A vendor emails a new bank account.'],
  tips: ['Call the vendor.', 'Check the sender.', 'Ask IT.'],
  takeaway: 'Pause before you pay.',
}

function reply(input: unknown) {
  return {
    stopReason: 'tool_use',
    usage: { inputTokens: 400, outputTokens: 300 },
    output: { message: { content: [{ toolUse: { input } }] } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BEDROCK_MODEL_ID', 'model-1')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('generateIssue', () => {
  it('returns the save_issue call with its token usage', async () => {
    send.mockResolvedValue(reply(ISSUE))

    expect(await generateIssue('phishing', ['Old title'])).toEqual({
      issue: ISSUE,
      source: null,
      model: 'model-1',
      inputTokens: 400,
      outputTokens: 300,
    })
    const prompt = send.mock.calls[0]?.[0].input.messages[0].content[0].text
    expect(prompt).toContain('Phishing & scams')
    expect(prompt).toContain('- Old title')
  })

  it('keeps a cited alert only when it was one the prompt offered', async () => {
    const alert = {
      title: 'Critical Java vulnerability',
      url: 'https://www.cisa.gov/news-events/alerts/java',
      publishedAt: new Date('2026-11-17T12:00:00.000Z'),
      summary: 'Patch now.',
    }
    send.mockResolvedValue(reply({ ...ISSUE, source_url: alert.url }))

    const draft = await generateIssue('devices', [], [alert])

    expect(draft.source).toEqual({ title: alert.title, url: alert.url })
    expect(draft.issue).not.toHaveProperty('source_url')
    const prompt = send.mock.calls[0]?.[0].input.messages[0].content[0].text
    expect(prompt).toContain('<alert url="' + alert.url + '"')
  })

  it('drops a url the model made up', async () => {
    send.mockResolvedValue(reply({ ...ISSUE, source_url: 'https://evil.example/fake' }))

    expect((await generateIssue('devices', [], [])).source).toBeNull()
  })

  it('refuses a draft with too few tips', async () => {
    send.mockResolvedValue(reply({ ...ISSUE, tips: ['Only one'] }))

    await expect(generateIssue('phishing', [])).rejects.toBeInstanceOf(DigestAiError)
  })

  it('refuses a reply that is only text', async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: 'Sure!' }] } } })

    await expect(generateIssue('devices', [])).rejects.toThrow('unusable draft')
  })

  it('explains an unreachable model', async () => {
    send.mockRejectedValue(new Error('throttled'))

    await expect(generateIssue('devices', [])).rejects.toThrow('could not be reached')
  })

  it('says the AI is not set up without a model id', async () => {
    vi.stubEnv('BEDROCK_MODEL_ID', '')

    await expect(generateIssue('devices', [])).rejects.toThrow('BEDROCK_MODEL_ID')
    expect(send).not.toHaveBeenCalled()
  })
})

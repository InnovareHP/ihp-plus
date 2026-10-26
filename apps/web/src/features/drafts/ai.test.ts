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

const { conversation, draftTurn, DraftAiError } = await import('./ai')

function toolReply(input: unknown, stopReason = 'tool_use') {
  return { stopReason, output: { message: { content: [{ toolUse: { input } }] } } }
}

const INPUT = {
  kind: 'contract' as const,
  title: 'Agreement',
  document: '# Agreement',
  messages: [
    { role: 'assistant' as const, content: 'Who is the client?' },
    { role: 'user' as const, content: 'Acme' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BEDROCK_MODEL_ID', 'model-1')
})
afterEach(() => vi.unstubAllEnvs())

describe('conversation', () => {
  it('drops the greeting and folds back-to-back turns of one role together', () => {
    expect(
      conversation([
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Acme' },
        { role: 'assistant', content: 'Done' },
        { role: 'assistant', content: 'Undone' },
        { role: 'user', content: 'Thanks' },
      ]),
    ).toEqual([
      { role: 'user', content: [{ text: 'Acme' }] },
      { role: 'assistant', content: [{ text: 'Done' }, { text: 'Undone' }] },
      { role: 'user', content: [{ text: 'Thanks' }] },
    ])
  })
})

describe('draftTurn', () => {
  it('returns the update_draft tool call', async () => {
    send.mockResolvedValue(
      toolReply({ reply: 'Added Acme.', title: 'Agreement — Acme', document: '# Agreement Acme' }),
    )

    expect(await draftTurn(INPUT)).toEqual({
      reply: 'Added Acme.',
      title: 'Agreement — Acme',
      document: '# Agreement Acme',
    })
    const command = send.mock.calls[0]?.[0] as { input: Record<string, unknown> }
    expect(command.input).toMatchObject({
      modelId: 'model-1',
      messages: [{ role: 'user', content: [{ text: 'Acme' }] }],
      toolConfig: { toolChoice: { auto: {} } },
    })
  })

  it('treats a plain-text answer as a reply that leaves the document alone', async () => {
    send.mockResolvedValue({
      stopReason: 'end_turn',
      output: { message: { content: [{ text: 'Is Acme an LLC or a corporation?' }] } },
    })

    expect(await draftTurn(INPUT)).toEqual({
      reply: 'Is Acme an LLC or a corporation?',
      title: 'Agreement',
      document: '# Agreement',
    })
  })

  it('attaches the proposal to the first user turn and tells the model to build on it', async () => {
    send.mockResolvedValue(toolReply({ reply: 'Drafted.', title: 'Agreement', document: '# A' }))
    const bytes = new Uint8Array([1, 2, 3])

    await draftTurn({ ...INPUT, proposal: { format: 'docx', bytes } })

    const command = send.mock.calls[0]?.[0] as {
      input: { system: { text: string }[]; messages: { content: unknown[] }[] }
    }
    expect(command.input.messages[0]?.content).toEqual([
      { document: { format: 'docx', name: 'Proposal', source: { bytes } } },
      { text: 'Acme' },
    ])
    expect(command.input.system[0]?.text).toContain('attached their proposal')
  })

  it('refuses to run without a model configured', async () => {
    vi.stubEnv('BEDROCK_MODEL_ID', '')
    await expect(draftTurn(INPUT)).rejects.toThrow(DraftAiError)
    expect(send).not.toHaveBeenCalled()
  })

  it('turns an unreachable service, a cut-off reply and a malformed reply into plain errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    send.mockRejectedValueOnce(new Error('AccessDeniedException'))
    await expect(draftTurn(INPUT)).rejects.toThrow('The AI could not be reached')

    send.mockResolvedValueOnce(toolReply({}, 'max_tokens'))
    await expect(draftTurn(INPUT)).rejects.toThrow('too long')

    send.mockResolvedValueOnce(toolReply({ reply: 'ok' }))
    await expect(draftTurn(INPUT)).rejects.toThrow('unusable reply')

    send.mockResolvedValueOnce({ stopReason: 'end_turn', output: { message: { content: [] } } })
    await expect(draftTurn(INPUT)).rejects.toThrow('unusable reply')
  })
})

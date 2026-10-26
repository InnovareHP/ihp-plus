import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from '@aws-sdk/client-bedrock-runtime'
import {
  aiTurnSchema,
  type AiTurn,
  type ChatMessage,
  type DraftKind,
  type ProposalFormat,
} from './schema'

/** A turn the model could not finish; the message is written for the admin. */
export class DraftAiError extends Error {}

const TOOL = 'update_draft'

let client: BedrockRuntimeClient | undefined

// No keys passed: the SDK's own chain reads AWS_* locally and the task role in production.
function bedrock() {
  client ??= new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  })
  return client
}

const PROPOSAL_RULE = `
- The admin attached their proposal for this client. Base the contract on it: take the scope, Schedule A deliverables, fees, milestone amounts, recurring fees, timeline and other terms from what it says. Rewrite, add or remove editable sections and Schedule A items so the contract matches what the proposal offers, keeping the contract's style and renumbering where needed. Use only values the proposal or the admin states.`

function systemPrompt(kind: DraftKind, document: string, hasProposal: boolean) {
  return `You help an Innovare HP admin draft a ${kind} by chatting. The current document is below.

Rules:
- Every turn, call the ${TOOL} tool exactly once with the whole updated document, your short reply and a title. Never answer in plain text.
- Replace a {{placeholder}} only with a value the admin gave you. Never invent names, amounts, dates or terms.
- In your reply, say what you changed in one or two sentences, then ask for the next few missing {{placeholders}} in plain words.
- {{client_...}} placeholders are optional client details. Never ask for them; fill one only if the admin gives it, otherwise leave it as is, since it prints as a blank to fill in by hand.
- Add, remove or reword sections when the admin asks, keeping the same markup: "# " title, "## " headings, "- " bullets, blank lines between paragraphs.
- A line like [locked section 1] stands for fixed legal wording you cannot see. Keep every such line exactly once, unchanged, on its own line where it is. If asked to change locked wording, explain that it is locked and leave it as is.
- The title is a short name for this draft, such as "Services agreement — Acme Corp".${hasProposal ? PROPOSAL_RULE : ''}

<document>
${document}
</document>`
}

// Bedrock wants turns that open on the user and alternate, so the greeting is dropped and an
// undo note is folded into the reply before it.
export function conversation(messages: readonly ChatMessage[]): Message[] {
  const first = messages.findIndex((message) => message.role === 'user')
  if (first === -1) return []

  const turns: Message[] = []
  for (const message of messages.slice(first)) {
    const last = turns.at(-1)
    if (last?.role === message.role) last.content?.push({ text: message.content })
    else turns.push({ role: message.role, content: [{ text: message.content }] })
  }
  return turns
}

export async function draftTurn(input: {
  kind: DraftKind
  title: string
  document: string
  messages: readonly ChatMessage[]
  proposal?: { format: ProposalFormat; bytes: Uint8Array }
}): Promise<AiTurn> {
  const modelId = process.env.BEDROCK_MODEL_ID
  if (!modelId) throw new DraftAiError('The AI is not set up yet — set BEDROCK_MODEL_ID.')

  const turns = conversation(input.messages)
  // The proposal rides on the first user turn, so every later turn can still read it.
  if (input.proposal) {
    turns[0]?.content?.unshift({
      document: {
        format: input.proposal.format,
        name: 'Proposal',
        source: { bytes: input.proposal.bytes },
      },
    })
  }

  let output
  try {
    output = await bedrock().send(
      new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt(input.kind, input.document, Boolean(input.proposal)) }],
        messages: turns,
        // The account caps a reply under 10,000 tokens; a full contract rewrite needs about 5,500.
        inferenceConfig: { maxTokens: 9000 },
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: TOOL,
                description: 'Save the updated document and reply to the admin.',
                inputSchema: {
                  json: {
                    type: 'object',
                    properties: {
                      reply: { type: 'string' },
                      title: { type: 'string' },
                      document: { type: 'string' },
                    },
                    required: ['reply', 'title', 'document'],
                  },
                },
              },
            },
          ],
          // Forcing a named tool is a 400 on current Claude models, so the prompt insists instead.
          toolChoice: { auto: {} },
        },
      }),
    )
  } catch (error) {
    console.error('[drafts] Bedrock call failed', error)
    throw new DraftAiError('The AI could not be reached — try again in a moment.')
  }

  if (output.stopReason === 'max_tokens') {
    throw new DraftAiError('The document grew too long for one reply — ask for a smaller change.')
  }
  const content = output.output?.message?.content ?? []
  const call = content.find((block) => block.toolUse)?.toolUse
  if (call) {
    const parsed = aiTurnSchema.safeParse(call.input)
    if (parsed.success) return parsed.data
    console.error('[drafts] update_draft input failed validation', parsed.error.issues)
  } else {
    // Without a forced tool the model sometimes just talks, usually to ask a question back.
    const text = content
      .map((block) => block.text ?? '')
      .join('\n')
      .trim()
    if (text) return { reply: text, title: input.title, document: input.document }
    console.error('[drafts] reply had neither a tool call nor text', output.stopReason)
  }
  throw new DraftAiError('The AI sent back an unusable reply — try again.')
}

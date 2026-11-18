import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { bedrock } from '@/lib/bedrock'
import { generatedIssueSchema, type DigestTopic, type GeneratedIssue } from './schema'
import type { PublicAlert } from './utils/alert-feed'
import { SAVE_ISSUE_SCHEMA, SAVE_ISSUE_TOOL, systemPrompt, userPrompt } from './utils/prompt'

/** A draft the model could not write; the message is shown to IT on the page. */
export class DigestAiError extends Error {}

export interface GeneratedDraft {
  issue: Omit<GeneratedIssue, 'source_url'>
  /** The alert the issue is about, only when the model named one it was actually offered. */
  source: { title: string; url: string } | null
  model: string
  inputTokens: number
  outputTokens: number
}

export function isAiConfigured() {
  return Boolean(process.env.BEDROCK_MODEL_ID)
}

export async function generateIssue(
  topic: DigestTopic,
  recentTitles: readonly string[],
  alerts: readonly PublicAlert[] = [],
): Promise<GeneratedDraft> {
  const modelId = process.env.BEDROCK_MODEL_ID
  if (!modelId) throw new DigestAiError('The AI is not set up yet — set BEDROCK_MODEL_ID.')

  let output
  try {
    output = await bedrock().send(
      new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt() }],
        messages: [{ role: 'user', content: [{ text: userPrompt(topic, recentTitles, alerts) }] }],
        inferenceConfig: { maxTokens: 4000 },
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: SAVE_ISSUE_TOOL,
                description: 'Save the finished security-awareness issue.',
                inputSchema: { json: SAVE_ISSUE_SCHEMA },
              },
            },
          ],
          // Forcing a named tool is a 400 on current Claude models, so the prompt insists instead.
          toolChoice: { auto: {} },
        },
      }),
    )
  } catch (error) {
    console.error('[security-digest] Bedrock call failed', error)
    throw new DigestAiError('The AI could not be reached — try again in a moment.')
  }

  const call = output.output?.message?.content?.find((block) => block.toolUse)?.toolUse
  const parsed = generatedIssueSchema.safeParse(call?.input)
  if (!parsed.success) {
    console.error('[security-digest] unusable reply', output.stopReason, parsed.error.issues)
    throw new DigestAiError('The AI sent back an unusable draft — generate it again.')
  }

  const { source_url: sourceUrl, ...issue } = parsed.data
  // A url the model made up, or reworded, is dropped rather than sent to staff as a citation.
  const alert = alerts.find((candidate) => candidate.url === sourceUrl)
  return {
    issue,
    source: alert ? { title: alert.title, url: alert.url } : null,
    model: modelId,
    inputTokens: output.usage?.inputTokens ?? 0,
    outputTokens: output.usage?.outputTokens ?? 0,
  }
}

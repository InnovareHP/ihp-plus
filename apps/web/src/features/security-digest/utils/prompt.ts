import { DIGEST_TOPIC_BRIEFS, DIGEST_TOPIC_LABELS, type DigestTopic } from '../schema'

export const SAVE_ISSUE_TOOL = 'save_issue'

export function systemPrompt() {
  return `You write a short weekly security-awareness email for the staff of Innovare Health Partners, a US company that works with healthcare clients. Readers are busy, non-technical office staff.

Rules:
- Call the ${SAVE_ISSUE_TOOL} tool exactly once with the finished issue. Never answer in plain text.
- One idea per issue, in plain American English at about an 8th-grade reading level. Sentence case. No jargon without a one-line explanation.
- Open with a realistic, specific scenario a reader could meet this week, then why it matters.
- Tips are 3 to 5 concrete actions, each starting with a verb and fitting on one or two lines.
- Never invent statistics, laws, product names, phone numbers, links or company policies. Do not include URLs.
- The takeaway is one memorable sentence.
- Friendly and calm, never alarmist or blaming.`
}

export function userPrompt(topic: DigestTopic, recentTitles: readonly string[]) {
  const avoid = recentTitles.length
    ? `\n\nRecent issues, so pick a different angle and do not repeat these titles:\n${recentTitles.map((title) => `- ${title}`).join('\n')}`
    : ''
  return `Write this week's issue on "${DIGEST_TOPIC_LABELS[topic]}": ${DIGEST_TOPIC_BRIEFS[topic]}.${avoid}`
}

export const SAVE_ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Headline, under 60 characters, no trailing period.' },
    preheader: { type: 'string', description: 'Inbox preview line, under 120 characters.' },
    intro: {
      type: 'array',
      items: { type: 'string' },
      description: 'One or two short paragraphs: the scenario, then why it matters.',
    },
    tips: { type: 'array', items: { type: 'string' }, description: '3 to 5 actions.' },
    takeaway: { type: 'string', description: 'One memorable sentence.' },
  },
  required: ['title', 'preheader', 'intro', 'tips', 'takeaway'],
}

import { z } from 'zod'

// Proposals are written elsewhere and attached; contracts are the one thing drafted here.
export type DraftKind = 'contract'

// Bedrock reads these two formats natively and refuses a document over 4.5 MB.
export const PROPOSAL_FORMATS = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
} as const
export type ProposalFormat = (typeof PROPOSAL_FORMATS)[keyof typeof PROPOSAL_FORMATS]
export const PROPOSAL_ACCEPT = '.pdf,.docx'
export const MAX_PROPOSAL_BYTES = 4.5 * 1024 * 1024

/** The same check client- and server-side, so the message a user reads is the rule enforced. */
export function proposalFileProblem(file: { size: number; type: string }) {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_PROPOSAL_BYTES) return 'The proposal has to be 4.5 MB or smaller.'
  if (!(file.type in PROPOSAL_FORMATS)) return 'Choose a PDF or a Word (.docx) file.'
  return undefined
}

export const newContractSchema = z.object({
  proposal: z
    .instanceof(File)
    .nullable()
    .superRefine((file, context) => {
      const problem = file ? proposalFileProblem(file) : undefined
      if (problem) context.addIssue({ code: 'custom', message: problem })
    }),
})
export type NewContractValues = z.infer<typeof newContractSchema>

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const MAX_MESSAGE_LENGTH = 4000

export const sendMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Type what to fill in or change.')
    .max(MAX_MESSAGE_LENGTH, `Keep a message under ${MAX_MESSAGE_LENGTH} characters.`),
})
export type SendMessageValues = z.infer<typeof sendMessageSchema>

/** What the model must hand back every turn, checked before anything is saved. */
export const aiTurnSchema = z.object({
  reply: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  document: z.string().trim().min(1),
})
export type AiTurn = z.infer<typeof aiTurnSchema>

export interface DraftRow {
  id: string
  kind: DraftKind
  title: string
  updatedAt: string
}

export interface DraftDetail extends DraftRow {
  /** The attached proposal's file name, or null for a contract started blank. */
  proposalName: string | null
  body: string
  canUndo: boolean
  messages: ChatMessage[]
}

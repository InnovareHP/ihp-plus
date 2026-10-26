'use server'

import { db } from '@ihp/db'
import { canManageOrganization, membershipOf, requireOnboarded } from '@/lib/auth-guard'
import { draftTurn, DraftAiError } from './ai'
import {
  chatMessageSchema,
  PROPOSAL_FORMATS,
  proposalFileProblem,
  sendMessageSchema,
  type ChatMessage,
  type DraftDetail,
  type DraftKind,
  type DraftRow,
  type ProposalFormat,
} from './schema'
import { hideLocked, restoreLocked } from './utils/document'
import { CONTRACT_TEMPLATE, contractGreeting } from './utils/templates'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

const NOT_ADMIN = 'Only admins can draft contracts.'
const GONE = 'That draft no longer exists.'

async function admin() {
  const { user, profile } = await requireOnboarded()
  const membership = membershipOf(profile)
  if (!canManageOrganization(membership) || !membership.organizationId) return undefined
  return { userId: user.id, organizationId: membership.organizationId }
}

interface DraftRecord {
  id: string
  kind: string
  title: string
  body: string
  previousBody: string | null
  messages: unknown
  proposalName: string | null
  updatedAt: Date
}

function rowOf(draft: Pick<DraftRecord, 'id' | 'kind' | 'title' | 'updatedAt'>): DraftRow {
  return {
    id: draft.id,
    kind: draft.kind as DraftKind,
    title: draft.title,
    updatedAt: draft.updatedAt.toISOString(),
  }
}

function messagesOf(value: unknown): ChatMessage[] {
  const parsed = chatMessageSchema.array().safeParse(value)
  return parsed.success ? parsed.data : []
}

function detailOf(draft: DraftRecord): DraftDetail {
  return {
    ...rowOf(draft),
    proposalName: draft.proposalName,
    body: draft.body,
    canUndo: draft.previousBody !== null,
    messages: messagesOf(draft.messages),
  }
}

export async function listDrafts(): Promise<Result<DraftRow[]>> {
  const caller = await admin()
  if (!caller) return { ok: false, message: NOT_ADMIN }

  const drafts = await db.draft.findMany({
    where: { organizationId: caller.organizationId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, kind: true, title: true, updatedAt: true },
  })
  return { ok: true, data: drafts.map(rowOf) }
}

export async function getDraft(draftId: string): Promise<Result<DraftDetail>> {
  const caller = await admin()
  if (!caller) return { ok: false, message: NOT_ADMIN }

  const draft = await db.draft.findFirst({
    where: { id: draftId, organizationId: caller.organizationId },
    omit: { proposal: true },
  })
  if (!draft) return { ok: false, message: GONE }
  return { ok: true, data: detailOf(draft) }
}

/** Starts a contract, from the proposal in `formData` when one is attached. */
export async function createDraft(formData: FormData): Promise<Result<DraftRow>> {
  const caller = await admin()
  if (!caller) return { ok: false, message: NOT_ADMIN }

  const file = formData.get('proposal')
  const proposal = file instanceof File && file.size > 0 ? file : null
  if (proposal) {
    const problem = proposalFileProblem(proposal)
    if (problem) return { ok: false, message: problem }
  }

  const draft = await db.draft.create({
    data: {
      organizationId: caller.organizationId,
      createdById: caller.userId,
      kind: 'contract',
      title: CONTRACT_TEMPLATE.title,
      body: CONTRACT_TEMPLATE.body,
      messages: [{ role: 'assistant', content: contractGreeting(proposal?.name ?? null) }],
      ...(proposal && {
        proposalName: proposal.name,
        proposalFormat: PROPOSAL_FORMATS[proposal.type as keyof typeof PROPOSAL_FORMATS],
        proposal: new Uint8Array(await proposal.arrayBuffer()),
      }),
    },
    select: { id: true, kind: true, title: true, updatedAt: true },
  })
  return { ok: true, data: rowOf(draft) }
}

export async function sendDraftMessage(
  draftId: string,
  text: string,
): Promise<Result<DraftDetail>> {
  const caller = await admin()
  if (!caller) return { ok: false, message: NOT_ADMIN }
  const parsed = sendMessageSchema.safeParse({ text })
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Try again.' }

  const draft = await db.draft.findFirst({
    where: { id: draftId, organizationId: caller.organizationId },
  })
  if (!draft) return { ok: false, message: GONE }

  const kind = draft.kind as DraftKind
  const messages: ChatMessage[] = [
    ...messagesOf(draft.messages),
    { role: 'user', content: parsed.data.text },
  ]

  const { text: visible, sections } = hideLocked(draft.body)
  let turn
  try {
    turn = await draftTurn({
      kind,
      title: draft.title,
      document: visible,
      messages,
      proposal:
        draft.proposal && draft.proposalFormat
          ? { format: draft.proposalFormat as ProposalFormat, bytes: draft.proposal }
          : undefined,
    })
  } catch (error) {
    if (error instanceof DraftAiError) return { ok: false, message: error.message }
    throw error
  }

  const body = restoreLocked(turn.document, sections)
  if (body === undefined) {
    return {
      ok: false,
      message:
        'The AI dropped or repeated a locked legal section, so nothing was saved — send the request again.',
    }
  }

  const saved = await db.draft.update({
    where: { id: draft.id },
    omit: { proposal: true },
    data: {
      title: turn.title,
      body,
      // A turn that only asked a question must not arm undo against an identical document.
      previousBody: body === draft.body ? draft.previousBody : draft.body,
      messages: [...messages, { role: 'assistant', content: turn.reply }],
    },
  })
  return { ok: true, data: detailOf(saved) }
}

/** Puts back the document from before the AI's last edit; the conversation stays as it was. */
export async function undoDraftChange(draftId: string): Promise<Result<DraftDetail>> {
  const caller = await admin()
  if (!caller) return { ok: false, message: NOT_ADMIN }

  const draft = await db.draft.findFirst({
    where: { id: draftId, organizationId: caller.organizationId },
  })
  if (!draft) return { ok: false, message: GONE }
  if (draft.previousBody === null) return { ok: false, message: 'There is no change to undo.' }

  const saved = await db.draft.update({
    where: { id: draft.id },
    omit: { proposal: true },
    data: {
      body: draft.previousBody,
      previousBody: null,
      messages: [
        ...messagesOf(draft.messages),
        { role: 'assistant', content: 'I undid my last change to the document.' },
      ],
    },
  })
  return { ok: true, data: detailOf(saved) }
}

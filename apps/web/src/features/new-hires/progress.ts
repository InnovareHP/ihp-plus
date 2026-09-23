import {
  CHECKLIST_STEPS,
  type ChecklistProgress,
  type ChecklistStep,
  type ProfileField,
} from './schema'

export interface HireFacts {
  phone: string | null
  photoKey: string | null
  teamIds: readonly string[]
  shiftName: string | undefined
  acknowledgedDocumentIds: ReadonlySet<string>
  completedTaskIds: ReadonlySet<string>
}

export interface RequiredDocument {
  id: string
  title: string
  /** Empty for the all-departments shelf. */
  teamIds: readonly string[]
}

export interface TaskDefinition {
  id: string
  title: string
  description: string | null
}

/** A document on the company shelf reaches everyone; one on department shelves, their members. */
export function reaches(document: RequiredDocument, teamIds: readonly string[]) {
  return document.teamIds.length === 0 || document.teamIds.some((id) => teamIds.includes(id))
}

export function progressOf(
  facts: HireFacts,
  documents: readonly RequiredDocument[],
  tasks: readonly TaskDefinition[],
): ChecklistProgress {
  const missing: ProfileField[] = []
  if (!facts.phone?.trim()) missing.push('phone')
  if (!facts.photoKey) missing.push('photo')

  const reading = documents
    .filter((document) => reaches(document, facts.teamIds))
    .map((document) => ({
      id: document.id,
      title: document.title,
      acknowledged: facts.acknowledgedDocumentIds.has(document.id),
    }))

  const items = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    done: facts.completedTaskIds.has(task.id),
  }))

  return {
    profile: { done: missing.length === 0, missing },
    // Nothing to read or tick off is a step already done, not one nobody can finish.
    reading: { done: reading.every((document) => document.acknowledged), documents: reading },
    shift: { done: facts.shiftName !== undefined, shiftName: facts.shiftName },
    tasks: { done: items.every((item) => item.done), items },
  }
}

export function doneCountOf(progress: ChecklistProgress) {
  return CHECKLIST_STEPS.filter((step) => progress[step].done).length
}

export function stuckOnOf(progress: ChecklistProgress): ChecklistStep | undefined {
  return CHECKLIST_STEPS.find((step) => !progress[step].done)
}

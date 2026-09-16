import type { FormKind, RequestQuery, RequestStatusFilter } from './schema'

export const requestKeys = {
  all: ['requests'] as const,
  forms: (kind: FormKind = 'request') => [...requestKeys.all, 'forms', kind] as const,
  form: (formId: string) => [...requestKeys.all, 'forms', formId] as const,
  available: () => [...requestKeys.all, 'available'] as const,
  mine: (status: RequestStatusFilter) => [...requestKeys.all, 'mine', status] as const,
  queue: (query: RequestQuery) => [...requestKeys.all, 'queue', query] as const,
  queues: () => [...requestKeys.all, 'queue'] as const,
  detail: (submissionId: string) => [...requestKeys.all, 'detail', submissionId] as const,
  approvers: () => [...requestKeys.all, 'approvers'] as const,
}

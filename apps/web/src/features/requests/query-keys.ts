import type { FormKind, FormListQuery, MyRequestQuery, RequestQuery } from './schema'

export const requestKeys = {
  all: ['requests'] as const,
  /** Prefix over every cached page of one catalogue, so an optimistic row reaches all of them. */
  forms: (kind: FormKind = 'request') => [...requestKeys.all, 'forms', kind] as const,
  formsPage: (query: FormListQuery) => [...requestKeys.forms(query.kind), 'page', query] as const,
  // Outside the forms prefix: it caches a plain list, not a page.
  publishedForms: (kind: FormKind = 'request') =>
    [...requestKeys.all, 'published-forms', kind] as const,
  form: (formId: string) => [...requestKeys.all, 'form', formId] as const,
  available: () => [...requestKeys.all, 'available'] as const,
  mines: () => [...requestKeys.all, 'mine'] as const,
  mine: (query: MyRequestQuery) => [...requestKeys.mines(), query] as const,
  queue: (query: RequestQuery) => [...requestKeys.all, 'queue', query] as const,
  queues: () => [...requestKeys.all, 'queue'] as const,
  detail: (submissionId: string) => [...requestKeys.all, 'detail', submissionId] as const,
  approvers: () => [...requestKeys.all, 'approvers'] as const,
}

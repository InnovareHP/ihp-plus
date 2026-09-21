'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { useOptimisticPagesMutation } from '@/lib/optimistic'
import { MAX_PAGE_SIZE } from '@/lib/pagination'
import { requestEvents } from '../events'
import { requestKeys } from '../query-keys'
import { deleteForm, getForm, listForms, saveForm, setFormStatus } from '../rpc'
import type {
  FormDraftValues,
  FormKind,
  FormListQuery,
  FormRow,
  FormsPage,
  FormStatus,
} from '../schema'

export function useForms(query: FormListQuery) {
  return useQuery({
    queryKey: requestKeys.formsPage(query),
    queryFn: () => listForms(query),
    // A filtered list must not blank out between pages.
    placeholderData: (previous) => previous,
  })
}

/** The assign picker offers the published catalogue rather than a page of it. */
export function usePublishedForms(kind: FormKind = 'request') {
  return useQuery({
    queryKey: requestKeys.publishedForms(kind),
    queryFn: async () => {
      const page = await listForms({
        kind,
        search: '',
        status: 'published',
        teamIds: [],
        unplacedOnly: false,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      })
      return page.rows
    },
  })
}

export function useForm(formId: string | undefined) {
  return useQuery({
    queryKey: requestKeys.form(formId ?? 'new'),
    enabled: Boolean(formId),
    queryFn: () => getForm(formId as string),
  })
}

// Not optimistic: the server assigns the id of a new form and resolves department names, so
// there is nothing dependable to paint before it answers.
export function useSaveForm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: FormDraftValues) => saveForm(values),
    onSuccess: (form) => {
      track(requestEvents.formSaved)
      queryClient.setQueryData(requestKeys.form(form.id), form)
      queryClient.invalidateQueries({ queryKey: requestKeys.forms(form.kind) })
    },
    onError: (error: Error) => {
      track(requestEvents.formSaveFailed, { reason: error.message })
    },
  })
}

export function useSetFormStatus(kind: FormKind = 'request') {
  return useOptimisticPagesMutation<FormsPage, { formId: string; status: FormStatus }>({
    queryKey: requestKeys.forms(kind),
    mutationFn: async (values) => {
      await setFormStatus(values)
    },
    apply: (page, values) => ({
      ...page,
      rows: page.rows.map((row: FormRow) =>
        row.id === values.formId ? { ...row, status: values.status } : row,
      ),
    }),
    successEvent: requestEvents.formPublished,
    failureEvent: requestEvents.formPublishFailed,
    alsoInvalidate: [requestKeys.available(), requestKeys.publishedForms(kind)],
  })
}

export function useDeleteForm(kind: FormKind = 'request') {
  return useOptimisticPagesMutation<FormsPage, { formId: string }>({
    queryKey: requestKeys.forms(kind),
    mutationFn: async (values) => {
      await deleteForm(values.formId)
    },
    // The total moves with the row, so the count under the table stays honest.
    apply: (page, values) => ({
      ...page,
      rows: page.rows.filter((row: FormRow) => row.id !== values.formId),
      pageInfo: { ...page.pageInfo, total: Math.max(0, page.pageInfo.total - 1) },
    }),
    successEvent: requestEvents.formDeleted,
    failureEvent: requestEvents.formDeleteFailed,
    alsoInvalidate: [requestKeys.publishedForms(kind)],
  })
}

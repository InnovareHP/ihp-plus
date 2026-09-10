'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { requestEvents } from './events'
import { requestKeys } from './query-keys'
import { deleteForm, getForm, listForms, saveForm, setFormStatus } from './rpc'
import type { FormDraftValues, FormRow, FormStatus } from './schema'

export function useForms() {
  return useQuery({
    queryKey: requestKeys.forms(),
    queryFn: listForms,
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
      queryClient.invalidateQueries({ queryKey: requestKeys.forms() })
    },
    onError: (error: Error) => {
      track(requestEvents.formSaveFailed, { reason: error.message })
    },
  })
}

export function useSetFormStatus() {
  return useOptimisticListMutation<FormRow, { formId: string; status: FormStatus }>({
    queryKey: requestKeys.forms(),
    mutationFn: async (values) => {
      await setFormStatus(values)
    },
    apply: (rows, values) =>
      rows.map((row) => (row.id === values.formId ? { ...row, status: values.status } : row)),
    successEvent: requestEvents.formPublished,
    failureEvent: requestEvents.formPublishFailed,
    alsoInvalidate: [requestKeys.available()],
  })
}

export function useDeleteForm() {
  return useOptimisticListMutation<FormRow, { formId: string }>({
    queryKey: requestKeys.forms(),
    mutationFn: async (values) => {
      await deleteForm(values.formId)
    },
    apply: (rows, values) => rows.filter((row) => row.id !== values.formId),
    successEvent: requestEvents.formDeleted,
    failureEvent: requestEvents.formDeleteFailed,
  })
}

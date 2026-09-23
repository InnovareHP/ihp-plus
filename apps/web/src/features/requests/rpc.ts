'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import { pageInfoFromProto } from '@/rpc/page-info'
import {
  approversFromProto,
  fieldToProto,
  formFromProto,
  formKindToProto,
  formStatusFilterToProto,
  formStatusToProto,
  requestStatusToProto,
  statusFilterToProto,
  submissionFromProto,
  valuesToProto,
} from '@/rpc/requests-codec'
import type {
  DecisionValues,
  DepartmentApproversRow,
  FormDraftValues,
  FormField,
  FormListQuery,
  FormRow,
  FormsPage,
  FormStatus,
  MyRequestQuery,
  RequestQuery,
  RequestRow,
  RequestValues,
  RequestsPage,
  SetApproverValues,
} from './schema'

/**
 * ConnectError stringifies as "[permission_denied] ...", putting a machine code in front of a
 * sentence a user reads. The code stays on the ConnectError for anything that branches on it;
 * what reaches the UI is the plain message.
 */
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

function requiredForm(form: Parameters<typeof formFromProto>[0] | undefined): FormRow {
  if (!form) throw new Error('The server did not return the form.')
  return formFromProto(form)
}

function requiredSubmission(
  submission: Parameters<typeof submissionFromProto>[0] | undefined,
): RequestRow {
  if (!submission) throw new Error('The server did not return the request.')
  return submissionFromProto(submission)
}

export async function listForms(query: FormListQuery): Promise<FormsPage> {
  const response = await call(() =>
    browserClients.requests.listForms({
      kind: formKindToProto(query.kind),
      search: query.search,
      status: formStatusFilterToProto(query.status),
      teamIds: [...query.teamIds],
      unplacedOnly: query.unplacedOnly,
      page: query.page,
      pageSize: query.pageSize,
    }),
  )

  return { rows: response.forms.map(formFromProto), pageInfo: pageInfoFromProto(response.pageInfo) }
}

export async function getForm(formId: string): Promise<FormRow> {
  const response = await call(() => browserClients.requests.getForm({ formId }))
  return requiredForm(response.form)
}

export async function saveForm(values: FormDraftValues): Promise<FormRow> {
  const response = await call(() =>
    browserClients.requests.saveForm({
      formId: values.formId,
      kind: formKindToProto(values.kind),
      name: values.name,
      description: values.description,
      fields: values.fields.map((field: FormField) => fieldToProto(field)),
      teamIds: values.teamIds,
      timeOff: values.timeOff,
    }),
  )
  return requiredForm(response.form)
}

export async function setFormStatus(values: {
  formId: string
  status: FormStatus
}): Promise<FormRow> {
  const response = await call(() =>
    browserClients.requests.setFormStatus({
      formId: values.formId,
      status: formStatusToProto(values.status),
    }),
  )
  return requiredForm(response.form)
}

export async function deleteForm(formId: string): Promise<void> {
  await call(() => browserClients.requests.deleteForm({ formId }))
}

export async function listAvailableForms(): Promise<FormRow[]> {
  const response = await call(() => browserClients.requests.listAvailableForms({}))
  return response.forms.map(formFromProto)
}

export async function submitRequest(values: {
  formId: string
  fields: readonly FormField[]
  values: RequestValues
}): Promise<RequestRow> {
  const response = await call(() =>
    browserClients.requests.submitRequest({
      formId: values.formId,
      values: valuesToProto(values.fields, values.values),
    }),
  )
  return requiredSubmission(response.submission)
}

export async function listMyRequests(query: MyRequestQuery): Promise<RequestsPage> {
  const response = await call(() =>
    browserClients.requests.listMyRequests({
      status: statusFilterToProto(query.status),
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    }),
  )

  return {
    rows: response.rows.map(submissionFromProto),
    pageInfo: pageInfoFromProto(response.pageInfo),
  }
}

export async function withdrawRequest(submissionId: string): Promise<RequestRow> {
  const response = await call(() => browserClients.requests.withdrawRequest({ submissionId }))
  return requiredSubmission(response.submission)
}

export async function listRequests(query: RequestQuery): Promise<RequestsPage> {
  const response = await call(() =>
    browserClients.requests.listRequests({
      status: statusFilterToProto(query.status),
      search: query.search,
      teamIds: [...query.teamIds],
      page: query.page,
      pageSize: query.pageSize,
    }),
  )

  return {
    rows: response.rows.map(submissionFromProto),
    pageInfo: pageInfoFromProto(response.pageInfo),
  }
}

export async function getRequest(submissionId: string): Promise<RequestRow> {
  const response = await call(() => browserClients.requests.getRequest({ submissionId }))
  return requiredSubmission(response.submission)
}

export async function decideRequest(values: DecisionValues): Promise<RequestRow> {
  const response = await call(() =>
    browserClients.requests.decideRequest({
      submissionId: values.submissionId,
      decision: requestStatusToProto(values.decision),
      note: values.note,
    }),
  )
  return requiredSubmission(response.submission)
}

export async function listApprovers(): Promise<DepartmentApproversRow[]> {
  const response = await call(() => browserClients.requests.listApprovers({}))
  return response.departments.map(approversFromProto)
}

export async function setApprover(values: SetApproverValues): Promise<DepartmentApproversRow> {
  const response = await call(() => browserClients.requests.setApprover(values))
  if (!response.department) throw new Error('The server did not return the department.')
  return approversFromProto(response.department)
}

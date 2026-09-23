import type { ServiceImpl } from '@ihp/rpc'
import { RequestsService } from '@ihp/rpc/requests'
import {
  decideRequest,
  deleteForm,
  loadApprovers,
  loadAvailableForms,
  loadForm,
  loadFormsPage,
  loadMyRequestsPage,
  loadRequest,
  loadRequestsPage,
  saveForm,
  setApprover,
  setFormStatus,
  submitRequest,
  withdrawRequest,
} from '@/features/requests/service'
import {
  approversToProto,
  fieldFromProto,
  formKindFromProto,
  formStatusFilterFromProto,
  formStatusFromProto,
  formToProto,
  requestStatusFromProto,
  statusFilterFromProto,
  submissionToProto,
  valuesFromProto,
} from './requests-codec'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import type { Decision } from '@/features/requests/schema'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const requests: ServiceImpl<typeof RequestsService> = {
  listForms: async (request) => {
    const page = await loadFormsPage({
      kind: formKindFromProto(request.kind),
      search: request.search,
      status: formStatusFilterFromProto(request.status),
      teamIds: request.teamIds,
      unplacedOnly: request.unplacedOnly,
      page: request.page || 1,
      pageSize: request.pageSize || DEFAULT_PAGE_SIZE,
    })

    return {
      forms: page.rows.map(formToProto),
      pageInfo: { $typeName: 'ihp.requests.v1.PageInfo' as const, ...page.pageInfo },
    }
  },

  getForm: async (request) => ({ form: formToProto(await loadForm(request.formId)) }),

  saveForm: async (request) => ({
    form: formToProto(
      await saveForm({
        formId: request.formId,
        kind: formKindFromProto(request.kind),
        name: request.name,
        description: request.description,
        fields: request.fields.map(fieldFromProto),
        teamIds: request.teamIds,
        timeOff: request.timeOff,
      }),
    ),
  }),

  setFormStatus: async (request) => ({
    form: formToProto(
      await setFormStatus({
        formId: request.formId,
        status: formStatusFromProto(request.status),
      }),
    ),
  }),

  deleteForm: async (request) => {
    await deleteForm(request.formId)
    return {}
  },

  listAvailableForms: async () => ({ forms: (await loadAvailableForms()).map(formToProto) }),

  submitRequest: async (request) => ({
    submission: submissionToProto(
      await submitRequest({
        formId: request.formId,
        values: valuesFromProto(request.values),
      }),
    ),
  }),

  listMyRequests: async (request) => {
    const page = await loadMyRequestsPage({
      status: statusFilterFromProto(request.status),
      search: request.search,
      page: request.page || 1,
      pageSize: request.pageSize || DEFAULT_PAGE_SIZE,
    })

    return {
      rows: page.rows.map(submissionToProto),
      pageInfo: { $typeName: 'ihp.requests.v1.PageInfo' as const, ...page.pageInfo },
    }
  },

  withdrawRequest: async (request) => ({
    submission: submissionToProto(await withdrawRequest(request.submissionId)),
  }),

  listRequests: async (request) => {
    const page = await loadRequestsPage({
      status: statusFilterFromProto(request.status),
      search: request.search,
      teamIds: request.teamIds,
      page: request.page || 1,
      pageSize: request.pageSize || DEFAULT_PAGE_SIZE,
    })

    return {
      rows: page.rows.map(submissionToProto),
      pageInfo: { $typeName: 'ihp.requests.v1.PageInfo', ...page.pageInfo },
    }
  },

  getRequest: async (request) => ({
    submission: submissionToProto(await loadRequest(request.submissionId)),
  }),

  decideRequest: async (request) => ({
    submission: submissionToProto(
      await decideRequest({
        submissionId: request.submissionId,
        // The proto shares one status enum; only these two are decisions a caller may send.
        decision: requestStatusFromProto(request.decision) as Decision,
        note: request.note,
      }),
    ),
  }),

  listApprovers: async () => ({ departments: (await loadApprovers()).map(approversToProto) }),

  setApprover: async (request) => ({
    department: approversToProto(
      await setApprover({
        teamId: request.teamId,
        userId: request.userId,
        approver: request.approver,
      }),
    ),
  }),
}

import type { ServiceImpl } from '@ihp/rpc'
import { RequestsService } from '@ihp/rpc/requests'
import {
  decideRequest,
  deleteForm,
  loadApprovers,
  loadAvailableForms,
  loadForm,
  loadForms,
  loadMyRequests,
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
  formStatusFromProto,
  formToProto,
  requestStatusFromProto,
  statusFilterFromProto,
  submissionToProto,
  valuesFromProto,
} from './requests-codec'
import type { Decision } from '@/features/requests/schema'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const requests: ServiceImpl<typeof RequestsService> = {
  listForms: async () => ({ forms: (await loadForms()).map(formToProto) }),

  getForm: async (request) => ({ form: formToProto(await loadForm(request.formId)) }),

  saveForm: async (request) => ({
    form: formToProto(
      await saveForm({
        formId: request.formId,
        name: request.name,
        description: request.description,
        fields: request.fields.map(fieldFromProto),
        teamIds: request.teamIds,
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

  listMyRequests: async (request) => ({
    rows: (await loadMyRequests(statusFilterFromProto(request.status))).map(submissionToProto),
  }),

  withdrawRequest: async (request) => ({
    submission: submissionToProto(await withdrawRequest(request.submissionId)),
  }),

  listRequests: async (request) => {
    const page = await loadRequestsPage({
      status: statusFilterFromProto(request.status),
      search: request.search,
      teamIds: request.teamIds,
      page: request.page || 1,
      pageSize: request.pageSize || 25,
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

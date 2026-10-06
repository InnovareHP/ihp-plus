import { Code, ConnectError, type ServiceImpl } from '@ihp/rpc'
import { LeaveService } from '@ihp/rpc/leave'
import {
  loadMyBalances,
  loadTeamBalances,
  previewLeave,
  setAllowance,
} from '@/features/leave/service'
import { balanceToProto, formAllowanceToProto, personToProto } from './leave-codec'

// Zero is proto3's "not set", so it asks for the organization's current year.
const yearOf = (year: number) => (year > 0 ? year : undefined)

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const leave: ServiceImpl<typeof LeaveService> = {
  listMyBalances: async (request) => {
    const mine = await loadMyBalances(yearOf(request.year))
    return { year: mine.year, balances: mine.balances.map(balanceToProto) }
  },

  listTeamBalances: async (request) => {
    const team = await loadTeamBalances(yearOf(request.year))
    return {
      year: team.year,
      forms: team.forms.map(formAllowanceToProto),
      people: team.people.map(personToProto),
    }
  },

  previewLeave: async (request) => {
    const preview = request.submissionId
      ? await previewLeave({ submissionId: request.submissionId })
      : await previewLeave({
          formId: request.formId ?? '',
          firstDay: request.firstDay ?? '',
          lastDay: request.lastDay ?? '',
        })
    return {
      workingDays: preview.workingDays,
      balance: preview.balance ? balanceToProto(preview.balance) : undefined,
    }
  },

  setAllowance: async (request) => {
    if (!request.formId || !request.userId) {
      throw new ConnectError('Pick a form and a person.', Code.InvalidArgument)
    }
    return {
      person: personToProto(
        await setAllowance({ formId: request.formId, userId: request.userId, days: request.days }),
      ),
    }
  },
}

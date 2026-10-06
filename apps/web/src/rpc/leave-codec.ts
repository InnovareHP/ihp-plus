import type {
  FormAllowance as FormAllowanceMessage,
  LeaveBalance as LeaveBalanceMessage,
  PersonBalances as PersonBalancesMessage,
} from '@ihp/rpc/leave'
import type { FormAllowance, LeaveBalance, PersonBalances } from '@/features/leave/schema'

export function balanceToProto(balance: LeaveBalance): LeaveBalanceMessage {
  return { $typeName: 'ihp.leave.v1.LeaveBalance', ...balance }
}

export function balanceFromProto(balance: LeaveBalanceMessage): LeaveBalance {
  return {
    formId: balance.formId,
    formName: balance.formName,
    allowance: balance.allowance,
    used: balance.used,
    pending: balance.pending,
    remaining: balance.remaining,
    overridden: balance.overridden,
  }
}

export function personToProto(person: PersonBalances): PersonBalancesMessage {
  return {
    $typeName: 'ihp.leave.v1.PersonBalances',
    userId: person.userId,
    name: person.name,
    balances: person.balances.map(balanceToProto),
  }
}

export function personFromProto(person: PersonBalancesMessage): PersonBalances {
  return {
    userId: person.userId,
    name: person.name,
    balances: person.balances.map(balanceFromProto),
  }
}

export function formAllowanceToProto(form: FormAllowance): FormAllowanceMessage {
  return { $typeName: 'ihp.leave.v1.FormAllowance', ...form }
}

export function formAllowanceFromProto(form: FormAllowanceMessage): FormAllowance {
  return { formId: form.formId, formName: form.formName, allowance: form.allowance }
}

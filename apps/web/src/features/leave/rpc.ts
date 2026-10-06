'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import { balanceFromProto, formAllowanceFromProto, personFromProto } from '@/rpc/leave-codec'
import type {
  LeavePreview,
  LeavePreviewInput,
  MyLeaveBalances,
  PersonBalances,
  SetAllowanceValues,
  TeamLeaveBalances,
} from './schema'

// ConnectError stringifies with its code in front; the UI shows only the sentence.
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

export async function listMyBalances(year?: number): Promise<MyLeaveBalances> {
  const response = await call(() => browserClients.leave.listMyBalances({ year: year ?? 0 }))
  return { year: response.year, balances: response.balances.map(balanceFromProto) }
}

export async function listTeamBalances(year?: number): Promise<TeamLeaveBalances> {
  const response = await call(() => browserClients.leave.listTeamBalances({ year: year ?? 0 }))
  return {
    year: response.year,
    forms: response.forms.map(formAllowanceFromProto),
    people: response.people.map(personFromProto),
  }
}

export async function previewLeave(input: LeavePreviewInput): Promise<LeavePreview> {
  const response = await call(() => browserClients.leave.previewLeave(input))
  return {
    workingDays: response.workingDays,
    balance: response.balance ? balanceFromProto(response.balance) : undefined,
  }
}

export async function setAllowance(values: SetAllowanceValues): Promise<PersonBalances> {
  const response = await call(() => browserClients.leave.setAllowance(values))
  if (!response.person) throw new Error('The server did not return the balances.')
  return personFromProto(response.person)
}

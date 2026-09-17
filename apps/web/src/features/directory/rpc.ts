'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import type { DirectoryDepartments, DirectoryPage, DirectoryQuery } from './schema'

/**
 * ConnectError stringifies as "[permission_denied] …", putting a machine code in front of a
 * sentence a user reads. What reaches the UI is the plain message.
 */
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

export async function listPeople(query: DirectoryQuery): Promise<DirectoryPage> {
  const response = await call(() =>
    browserClients.directory.listPeople({
      search: query.search,
      teamIds: [...query.teamIds],
      page: query.page,
      pageSize: query.pageSize,
    }),
  )

  return {
    rows: response.people.map((person) => ({
      userId: person.userId,
      name: person.name,
      jobTitle: person.jobTitle,
      department: person.department,
      email: person.email,
      phone: person.phone,
      ihpId: person.ihpId,
      employmentType: person.employmentType,
      photoUrl: person.photoUrl,
      startDate: person.startDate,
      isLead: person.isLead,
    })),
    pageInfo: {
      page: response.pageInfo?.page ?? 1,
      pageSize: response.pageInfo?.pageSize ?? query.pageSize,
      total: response.pageInfo?.total ?? 0,
      pageCount: response.pageInfo?.pageCount ?? 1,
      hasPrevious: response.pageInfo?.hasPrevious ?? false,
      hasNext: response.pageInfo?.hasNext ?? false,
    },
  }
}

export async function listDepartments(): Promise<DirectoryDepartments> {
  const response = await call(() => browserClients.directory.listDepartments({}))

  return {
    departments: response.departments.map((department) => ({
      teamId: department.teamId,
      name: department.name,
      memberCount: department.memberCount,
    })),
    unassignedCount: response.unassignedCount,
  }
}

import type { ServiceImpl } from '@ihp/rpc'
import { DirectoryService } from '@ihp/rpc/directory'
import { loadDepartments, loadDirectoryPage } from '@/features/directory/service'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const directory: ServiceImpl<typeof DirectoryService> = {
  listPeople: async (request) => {
    const page = await loadDirectoryPage({
      search: request.search,
      teamIds: request.teamIds,
      page: request.page,
      pageSize: request.pageSize,
    })

    return {
      people: page.rows.map((row) => ({
        $typeName: 'ihp.directory.v1.Person' as const,
        userId: row.userId,
        name: row.name,
        jobTitle: row.jobTitle,
        department: row.department,
        email: row.email,
        phone: row.phone,
        ihpId: row.ihpId,
        employmentType: row.employmentType,
        photoUrl: row.photoUrl,
        startDate: row.startDate,
        isLead: row.isLead,
      })),
      pageInfo: { $typeName: 'ihp.directory.v1.PageInfo' as const, ...page.pageInfo },
    }
  },

  listDepartments: async () => {
    const data = await loadDepartments()

    return {
      departments: data.departments.map((department) => ({
        $typeName: 'ihp.directory.v1.Department' as const,
        ...department,
      })),
      unassignedCount: data.unassignedCount,
    }
  },
}

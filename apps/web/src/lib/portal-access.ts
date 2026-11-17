import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'

const ac = createAccessControl(defaultStatements)

// A superadmin holds every admin permission; the extra reach (company-wide reports) is checked in code.
export const portalAccess = {
  ac,
  roles: { admin: adminAc, user: userAc, superadmin: ac.newRole(adminAc.statements) },
  adminRoles: ['admin', 'superadmin'],
}

export const PORTAL_ADMIN_ROLES: readonly string[] = portalAccess.adminRoles

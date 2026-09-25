// Next's basePath: every route below is written without it, and next/link prepends it.
export const BASE_PATH = '/app'

export const routes = {
  dashboard: '/',
  bulletin: '/bulletin',
  directory: '/directory',
  directoryChart: '/directory/chart',
  clients: '/clients',
  bluebook: '/bluebook',
  library: '/library',
  tasks: '/tasks',
  attendance: '/attendance',
  attendanceTeam: '/attendance/team',
  attendanceCalendar: '/attendance/calendar',
  onboarding: '/onboarding',
  requests: '/requests',
  requestApprovals: '/requests/approvals',
  requestForms: '/requests/forms',
  evaluations: '/evaluations',
  evaluationTracker: '/evaluations/assigned',
  evaluationForms: '/evaluations/forms',
  organization: '/organization',
  folderAccess: '/folder-access',
  settings: '/settings',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  acceptInvitation: '/accept-invitation',
  clientContract: '/contract',
} as const

export type Route = (typeof routes)[keyof typeof routes]

/**
 * The organization screen is one page of tabs rather than four routes: overview, members,
 * departments and invitations are all the same subject, and splitting them meant four page
 * loads to do one job. The tab is a query param so each is still a deep link.
 */
export const ORGANIZATION_TABS = [
  'overview',
  'members',
  'departments',
  'invitations',
  'onboarding',
] as const

export type OrganizationTab = (typeof ORGANIZATION_TABS)[number]

/** The admin half of attendance is one screen of tabs: today, timesheets, the month, the shifts. */
export const ATTENDANCE_TABS = ['today', 'timesheets', 'calendar', 'shifts'] as const

export type AttendanceTab = (typeof ATTENDANCE_TABS)[number]

/** Clients splits the same way: the book of clients, what they signed, and what it costs. */
export const CLIENT_TABS = ['clients', 'contracts', 'rates'] as const

export type ClientTab = (typeof CLIENT_TABS)[number]

export function clientTab(tab: ClientTab) {
  return tab === 'clients' ? routes.clients : `${routes.clients}?tab=${tab}`
}

export function organizationTab(tab: OrganizationTab) {
  return tab === 'overview' ? routes.organization : `${routes.organization}?tab=${tab}`
}

// A "next" value from the query string is attacker-controlled, so only in-app paths pass.
export function safeNextRoute(value: string | null, fallback: string = routes.dashboard) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

// Static segments rather than a bare /requests/[id]: the queue and the builder sit under the
// same prefix, and a literal segment keeps them from ever colliding with an id.
/** One post on the board, with its replies open: what a mention email links to. */
export function bulletinPostRoute(postId: string) {
  return `${routes.bulletin}?post=${encodeURIComponent(postId)}`
}

export function newRequestRoute(formId: string) {
  return `${routes.requests}/new/${formId}`
}

export function requestRoute(submissionId: string) {
  return `${routes.requests}/view/${submissionId}`
}

export function requestFormRoute(formId: string) {
  return `${routes.requestForms}/${formId}`
}

export const NEW_REQUEST_FORM_ROUTE = `${routes.requestForms}/new`

export function evaluationRoute(evaluationId: string) {
  return `${routes.evaluations}/view/${evaluationId}`
}

export function fillEvaluationRoute(evaluationId: string) {
  return `${routes.evaluations}/fill/${evaluationId}`
}

export function evaluationFormRoute(formId: string) {
  return `${routes.evaluationForms}/${formId}`
}

export const NEW_EVALUATION_FORM_ROUTE = `${routes.evaluationForms}/new`

export function invitationRoute(invitationId: string) {
  return `${routes.acceptInvitation}/${invitationId}`
}

// The address rides along so the page can name the inbox to open and resend to it.
export function verifyEmailRoute(email: string, next?: string) {
  const query = new URLSearchParams({ email })
  if (next) query.set('next', next)
  return `${routes.verifyEmail}?${query.toString()}`
}

export function clientContractRoute(contractId: string, signature: string) {
  return `${routes.clientContract}/${contractId}/${signature}`
}

// Open with or without a session: a manager opening a client link sees what the client sees, and
// accepting an invitation needs the session the guard would otherwise bounce to the dashboard.
export const SHARED_ROUTES: readonly Route[] = [routes.clientContract, routes.acceptInvitation]

export function isSharedRoute(pathname: string) {
  return SHARED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

// The (auth) route group is invisible in the URL, so the guard matches these prefixes instead.
export const PUBLIC_ROUTES: readonly Route[] = [
  routes.login,
  routes.forgotPassword,
  routes.resetPassword,
  routes.verifyEmail,
]

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

// OAuth callbacks and Better Auth's own base are real browser URLs, so they carry the basePath.
export function withBasePath(route: string) {
  return route === '/' ? BASE_PATH : `${BASE_PATH}${route}`
}

export const AUTH_BASE_PATH = withBasePath('/api/auth')

/**
 * A task file's permanent link: the route signs a fresh storage URL on every open, so the link
 * never expires the way a presigned one does. A plain href, so basePath is written in here.
 */
export function taskAttachmentUrl(attachmentId: string) {
  return withBasePath(`/api/tasks/attachments/${encodeURIComponent(attachmentId)}`)
}

/** A request's file answer, signed afresh on every open like a task file. */
export function requestFileHref(submissionId: string, fieldId: string) {
  return withBasePath(
    `/api/requests/${encodeURIComponent(submissionId)}/files/${encodeURIComponent(fieldId)}`,
  )
}

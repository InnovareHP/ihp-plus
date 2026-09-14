// Next's basePath: every route below is written without it, and next/link prepends it.
export const BASE_PATH = '/app'

export const routes = {
  dashboard: '/',
  directory: '/directory',
  clients: '/clients',
  bluebook: '/bluebook',
  onboarding: '/onboarding',
  requests: '/requests',
  requestApprovals: '/requests/approvals',
  requestForms: '/requests/forms',
  organization: '/organization',
  settings: '/settings',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvitation: '/accept-invitation',
  clientContract: '/contract',
} as const

export type Route = (typeof routes)[keyof typeof routes]

/**
 * The organization screen is one page of tabs rather than four routes: overview, members,
 * departments, invitations and approvers are all the same subject, and splitting them meant
 * four page loads to do one job. The tab is a query param so each is still a deep link.
 */
export const ORGANIZATION_TABS = [
  'overview',
  'members',
  'departments',
  'invitations',
  'approvers',
] as const

export type OrganizationTab = (typeof ORGANIZATION_TABS)[number]

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

export function invitationRoute(invitationId: string) {
  return `${routes.acceptInvitation}/${invitationId}`
}

export function clientContractRoute(contractId: string, signature: string) {
  return `${routes.clientContract}/${contractId}/${signature}`
}

// Open with or without a session, so a manager opening a client link sees what the client sees.
export const SHARED_ROUTES: readonly Route[] = [routes.clientContract]

export function isSharedRoute(pathname: string) {
  return SHARED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

// The (auth) route group is invisible in the URL, so the guard matches these prefixes instead.
export const PUBLIC_ROUTES: readonly Route[] = [
  routes.login,
  routes.signup,
  routes.forgotPassword,
  routes.resetPassword,
  routes.acceptInvitation,
]

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

// OAuth callbacks and Better Auth's own base are real browser URLs, so they carry the basePath.
export function withBasePath(route: string) {
  return route === '/' ? BASE_PATH : `${BASE_PATH}${route}`
}

export const AUTH_BASE_PATH = withBasePath('/api/auth')

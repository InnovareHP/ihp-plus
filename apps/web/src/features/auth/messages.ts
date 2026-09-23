// Better Auth returns machine codes; a user must never be shown one.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'That email and password do not match an account.',
  USER_ALREADY_EXISTS: 'An account with that email already exists. Try signing in instead.',
  EMAIL_NOT_VERIFIED: 'Verify your email address before signing in — check your inbox.',
  INVALID_TOKEN: 'That reset link has expired. Request a new one.',
  PASSWORD_TOO_SHORT: 'That password is too short.',
  ACCOUNT_NOT_LINKED:
    'That Outlook account is not linked to this email. Sign in with a password first.',
  YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: 'Only a portal admin can sign in as someone else.',
  YOU_CANNOT_IMPERSONATE_ADMINS: 'You cannot sign in as another portal admin.',
  FAILED_TO_CREATE_USER: 'The account could not be created. Try again in a moment.',
}

export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return 'Something went wrong. Try again.'
  const known = error.code ? MESSAGES[error.code] : undefined
  return known ?? error.message ?? 'Something went wrong. Try again.'
}

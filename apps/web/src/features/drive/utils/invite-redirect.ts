/** Where a guest lands after redeeming, when the portal's own URL is not one Entra accepts. */
const MY_APPS = 'https://myapplications.microsoft.com'

/**
 * Entra rejects the invitation outright — `BadRequest: The invite redirect URL field is
 * invalid` — for anything but a well-formed https URL, so a dev portal on http://localhost
 * sends guests to My Apps instead of failing the share.
 */
export function inviteRedirectUrl(candidate: string | undefined) {
  if (!candidate) return MY_APPS

  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' ? url.toString() : MY_APPS
  } catch {
    return MY_APPS
  }
}

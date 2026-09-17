import { graphJson, graphVoid } from './client'
import type { GraphPermission, GuestInvitation } from './types'

export type ShareRole = 'read' | 'write'

export interface ShareResult {
  granted: GraphPermission[]
  /** Graph answers a part-failed invite with 207, so a refused recipient is not an exception. */
  failed: { email: string | undefined; message: string }[]
}

/**
 * Creates the B2B guest. App-only access cannot invite a *new* guest to a drive item, so an
 * unknown client has to exist as a guest first — this is that step, and it needs User.Invite.All.
 */
export function inviteGuest(email: string, displayName: string, redirectUrl: string) {
  return graphJson<GuestInvitation>('/invitations', {
    method: 'POST',
    body: {
      invitedUserEmailAddress: email,
      invitedUserDisplayName: displayName,
      inviteRedirectUrl: redirectUrl,
      // The portal sends its own mail through lib/email.ts, in the app's voice.
      sendInvitationMessage: false,
    },
  })
}

/** Grants existing guests access to one folder or file. */
export async function shareItem(
  driveId: string,
  itemId: string,
  emails: string[],
  role: ShareRole = 'read',
) {
  const payload = await graphJson<{ value: GraphPermission[] }>(
    `/drives/${driveId}/items/${itemId}/invite`,
    {
      method: 'POST',
      body: {
        recipients: emails.map((email) => ({ email })),
        roles: [role],
        requireSignIn: true,
        sendInvitation: false,
        retainInheritedPermissions: false,
      },
    },
  )

  const granted: GraphPermission[] = []
  const failed: ShareResult['failed'] = []
  for (const permission of payload.value) {
    if (permission.error) {
      failed.push({
        email: permission.invitation?.email,
        message: permission.error.message ?? permission.error.code ?? 'Unknown error.',
      })
    } else {
      granted.push(permission)
    }
  }

  return { granted, failed } satisfies ShareResult
}

/**
 * The fallback when Sites.Selected turns out not to cover invite: a link instead of a grant.
 * `organization` keeps it inside the tenant; `anonymous` needs the tenant sharing policy to allow it.
 */
export function createLink(
  driveId: string,
  itemId: string,
  options: {
    type?: 'view' | 'edit'
    scope?: 'anonymous' | 'organization' | 'users'
    expirationDateTime?: string
    password?: string
  } = {},
) {
  return graphJson<GraphPermission>(`/drives/${driveId}/items/${itemId}/createLink`, {
    method: 'POST',
    body: { type: options.type ?? 'view', scope: options.scope ?? 'organization', ...options },
  })
}

export async function listPermissions(driveId: string, itemId: string) {
  const payload = await graphJson<{ value: GraphPermission[] }>(
    `/drives/${driveId}/items/${itemId}/permissions`,
  )
  return payload.value
}

export function revokePermission(driveId: string, itemId: string, permissionId: string) {
  return graphVoid(`/drives/${driveId}/items/${itemId}/permissions/${permissionId}`, {
    method: 'DELETE',
  })
}

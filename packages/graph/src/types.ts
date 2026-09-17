export interface DriveItemRef {
  driveId?: string
  id?: string
  path?: string
}

export interface DriveItem {
  id: string
  name: string
  eTag?: string
  cTag?: string
  size?: number
  webUrl?: string
  createdDateTime?: string
  lastModifiedDateTime?: string
  parentReference?: DriveItemRef
  file?: { mimeType?: string; hashes?: { quickXorHash?: string; sha256Hash?: string } }
  folder?: { childCount?: number }
  /** Present only on items delta reports as removed. */
  deleted?: { state?: string }
  '@microsoft.graph.downloadUrl'?: string
}

export interface DeltaPage {
  items: DriveItem[]
  /** Follow it for the rest of this sweep. */
  nextLink: string | undefined
  /** Store it; the next sweep starts here. */
  deltaLink: string | undefined
}

export interface GraphSubscription {
  id: string
  resource: string
  expirationDateTime: string
  clientState?: string
  notificationUrl: string
}

export interface GraphPermission {
  id: string
  roles?: string[]
  grantedToV2?: { user?: { id?: string; displayName?: string } }
  invitation?: { email?: string; signInRequired?: boolean }
  link?: { webUrl?: string; scope?: string; type?: string }
  expirationDateTime?: string
  /** An invite can fail per recipient while the request as a whole returns 207. */
  error?: { code?: string; message?: string }
}

export interface GuestInvitation {
  id: string
  invitedUserEmailAddress: string
  inviteRedeemUrl?: string
  invitedUser?: { id?: string }
  status?: string
}

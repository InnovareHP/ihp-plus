import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const graph = vi.hoisted(() => ({
  ensureFolder: vi.fn(async (_driveId: string, _parentId: string, name: string) => ({
    id: name === 'Clients' ? 'internal-clients' : 'folder-1',
    name,
    webUrl: 'https://sharepoint.test/Acme',
  })),
  inviteGuest: vi.fn(async () => ({ id: 'inv-1', invitedUser: { id: 'guest-user-1' } })),
  shareItem: vi.fn(
    async (): Promise<{
      granted: { id: string }[]
      failed: { email: string; message: string }[]
    }> => ({ granted: [{ id: 'perm-1' }], failed: [] }),
  ),
  revokePermission: vi.fn(),
  createLink: vi.fn(async () => ({
    id: 'perm-link-1',
    link: { webUrl: 'https://sharepoint.test/:f:/s/ihp-clients/anon' },
  })),
  createFolder: vi.fn(async () => ({
    id: 'group-folder',
    name: 'Smith Holdings',
    webUrl: 'https://sharepoint.test/Smith',
  })),
  moveItem: vi.fn(async () => ({
    id: 'folder-1',
    name: 'Acme',
    webUrl: 'https://sharepoint.test/Smith/Acme',
  })),
  deleteItem: vi.fn(),
  requireClientDriveId: vi.fn(() => 'client-drive'),
  requireInternalDriveId: vi.fn(() => 'internal-drive'),
  rootItem: vi.fn(async (driveId: string) => ({ id: `${driveId}-root`, name: 'root' })),
}))

const service = vi.hoisted(() => ({
  clientForAccess: vi.fn(),
  clientDriveFolder: vi.fn(),
  saveClientDriveFolder: vi.fn(),
  guestFor: vi.fn(),
  guestsFor: vi.fn(async () => [] as unknown[]),
  guestById: vi.fn(),
  saveGuest: vi.fn(),
  markGuestRevoked: vi.fn(),
  organizationName: vi.fn(async () => 'IHP+'),
  organizationAccess: vi.fn(),
  clientByFolderName: vi.fn(async (): Promise<unknown> => null),
  clientGroups: vi.fn(),
  groupFor: vi.fn(),
  groupNamed: vi.fn(async () => null),
  saveGroup: vi.fn(),
  archiveGroup: vi.fn(),
  groupMemberCount: vi.fn(async () => 0),
  groupGuestFor: vi.fn(async () => null),
  groupGuestsFor: vi.fn(async () => [] as unknown[]),
  saveGroupGuest: vi.fn(),
  moveClientDriveFolder: vi.fn(),
}))

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(async () => ({ user: { id: 'user-1', name: 'Sam' }, profile: {} })),
  membershipOf: vi.fn((): { organizationId: string | undefined } => ({ organizationId: 'org-1' })),
  canManageOrganization: vi.fn(() => true),
}))

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }))

class TestGraphError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
  get isConflict() {
    return this.status === 409
  }
  get isNotFound() {
    return this.status === 404
  }
}

vi.mock('@ihp/graph', () => ({
  ...graph,
  GraphNotConfiguredError: class GraphNotConfiguredError extends Error {},
  GraphError: TestGraphError,
}))
vi.mock('./service', () => service)
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: mail.sendEmail,
}))

const {
  addClientToGroup,
  createClientGroup,
  deleteClientGroup,
  listClientAccess,
  listOrganizationAccess,
  removeClientFromGroup,
  revokeClientFolderAccess,
  shareClientFolder,
  shareGroupFolder,
} = await import('./actions')

const CLIENT_ID = '11111111-1111-4111-8111-111111111111'
const GUEST_ID = '22222222-2222-4222-8222-222222222222'
const GROUP_ID = '33333333-3333-4333-8333-333333333333'

const GROUP = {
  id: GROUP_ID,
  organizationId: 'org-1',
  name: 'Smith Holdings',
  driveId: 'client-drive',
  itemId: 'group-folder',
  webUrl: 'https://sharepoint.test/Smith',
  archivedAt: null,
}

const GUEST_ROW = {
  id: GUEST_ID,
  clientId: CLIENT_ID,
  email: 'buyer@acme.test',
  role: 'read',
  invitedUserId: 'guest-user-1',
  permissionId: 'perm-1',
  invitedAt: new Date('2026-03-04T10:00:00.000Z'),
  revokedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.membershipOf.mockReturnValue({ organizationId: 'org-1' })
  guard.canManageOrganization.mockReturnValue(true)
  service.clientForAccess.mockResolvedValue({ id: CLIENT_ID, name: 'Acme' })
  service.clientDriveFolder.mockResolvedValue(null)
  service.saveClientDriveFolder.mockResolvedValue({
    driveId: 'client-drive',
    itemId: 'folder-1',
    webUrl: 'https://sharepoint.test/Acme',
  })
  service.guestFor.mockResolvedValue(null)
  service.saveGuest.mockResolvedValue(GUEST_ROW)
  service.guestById.mockResolvedValue(GUEST_ROW)
  service.markGuestRevoked.mockResolvedValue({ ...GUEST_ROW, revokedAt: new Date() })
  graph.shareItem.mockResolvedValue({ granted: [{ id: 'perm-1' }], failed: [] })
  service.groupFor.mockResolvedValue(GROUP)
  service.saveGroup.mockResolvedValue(GROUP)
  service.saveGroupGuest.mockResolvedValue({ ...GUEST_ROW, clientId: null, groupId: GROUP_ID })
})

describe('shareClientFolder', () => {
  it('creates the B2B guest before sharing, because app-only cannot invite a new one', async () => {
    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'Buyer@Acme.test' })

    expect(graph.inviteGuest).toHaveBeenCalled()
    expect(graph.shareItem).toHaveBeenCalledWith(
      'client-drive',
      'folder-1',
      ['buyer@acme.test'],
      'read',
    )
    expect(service.saveGuest).toHaveBeenCalledWith(
      expect.objectContaining({ permissionId: 'perm-1', invitedUserId: 'guest-user-1' }),
    )
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ email: 'buyer@acme.test' }),
    })
  })

  it('makes the staff folder in the internal library alongside the client one', async () => {
    await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(graph.ensureFolder).toHaveBeenNthCalledWith(
      1,
      'internal-drive',
      'internal-drive-root',
      'Clients',
    )
    expect(graph.ensureFolder).toHaveBeenNthCalledWith(
      2,
      'internal-drive',
      'internal-clients',
      'Acme',
    )
    expect(graph.ensureFolder).toHaveBeenNthCalledWith(
      3,
      'client-drive',
      'client-drive-root',
      'Acme',
    )
  })

  it('still shares when the internal library cannot be written to', async () => {
    graph.requireInternalDriveId.mockImplementationOnce(() => {
      throw new Error('not configured')
    })

    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(result).toMatchObject({ ok: true })
    expect(graph.shareItem).toHaveBeenCalled()
  })

  it('does not re-invite someone Entra already knows as a guest', async () => {
    service.guestFor.mockResolvedValue({ ...GUEST_ROW, invitedUserId: 'guest-user-1' })

    await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(graph.inviteGuest).not.toHaveBeenCalled()
    expect(graph.shareItem).toHaveBeenCalled()
  })

  it('reuses the folder already recorded for the client', async () => {
    service.clientDriveFolder.mockResolvedValue({
      driveId: 'client-drive',
      itemId: 'folder-existing',
      webUrl: 'https://sharepoint.test/Acme',
    })

    await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(graph.ensureFolder).not.toHaveBeenCalled()
    expect(graph.shareItem).toHaveBeenCalledWith(
      'client-drive',
      'folder-existing',
      expect.anything(),
      'read',
    )
  })

  it('sends the folder link in the portal’s own voice, not Microsoft’s', async () => {
    await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(mail.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@acme.test',
        subject: expect.stringContaining('shared'),
      }),
    )
  })

  it('reports the reason when Microsoft refuses the address, and grants nothing', async () => {
    graph.shareItem.mockResolvedValue({
      granted: [],
      failed: [{ email: 'buyer@acme.test', message: 'External sharing is off for this site.' }],
    })

    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(result).toEqual({
      ok: false,
      message: 'Microsoft refused that address — External sharing is off for this site.',
    })
    expect(service.saveGuest).not.toHaveBeenCalled()
  })

  it('rejects an address that is not an email before calling Graph', async () => {
    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'not-an-email' })

    expect(result.ok).toBe(false)
    expect(graph.shareItem).not.toHaveBeenCalled()
  })

  it('refuses a client that belongs to another organization', async () => {
    service.clientForAccess.mockResolvedValue(null)

    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(result).toEqual({ ok: false, message: 'That client no longer exists.' })
    expect(graph.shareItem).not.toHaveBeenCalled()
  })

  it('repeats the code Microsoft gave rather than a generic retry line', async () => {
    graph.shareItem.mockRejectedValueOnce(new TestGraphError(403, 'accessDenied', 'Access denied.'))

    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(result).toEqual({
      ok: false,
      message:
        'Microsoft refused that (accessDenied) — check external sharing is on for the client site.',
    })
  })

  it('falls back to a plain message when the failure is not Graph’s', async () => {
    graph.shareItem.mockRejectedValueOnce(new Error('socket hang up'))

    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(result).toEqual({ ok: false, message: 'Could not share that folder — try again.' })
  })

  it('says what to do when Graph is not configured yet', async () => {
    const { GraphNotConfiguredError } = await import('@ihp/graph')
    graph.requireClientDriveId.mockImplementationOnce(() => {
      throw new GraphNotConfiguredError()
    })

    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(result).toEqual({
      ok: false,
      message: 'Document sync is not configured yet — tell an admin to set the GRAPH variables.',
    })
  })
})

describe('revokeClientFolderAccess', () => {
  it('deletes the permission and keeps the row as history', async () => {
    service.clientDriveFolder.mockResolvedValue({ driveId: 'client-drive', itemId: 'folder-1' })

    const result = await revokeClientFolderAccess(GUEST_ID)

    expect(graph.revokePermission).toHaveBeenCalledWith('client-drive', 'folder-1', 'perm-1')
    expect(service.markGuestRevoked).toHaveBeenCalledWith(GUEST_ID)
    expect(result.ok).toBe(true)
  })

  it('refuses a guest of a client in another organization', async () => {
    service.clientForAccess.mockResolvedValue(null)

    const result = await revokeClientFolderAccess(GUEST_ID)

    expect(result.ok).toBe(false)
    expect(graph.revokePermission).not.toHaveBeenCalled()
  })

  it('leaves the row untouched when Graph refuses the delete', async () => {
    service.clientDriveFolder.mockResolvedValue({ driveId: 'client-drive', itemId: 'folder-1' })
    graph.revokePermission.mockRejectedValueOnce(new Error('403'))

    const result = await revokeClientFolderAccess(GUEST_ID)

    expect(result).toEqual({ ok: false, message: 'Could not remove that access — try again.' })
    expect(service.markGuestRevoked).not.toHaveBeenCalled()
  })
})

describe('listClientAccess', () => {
  it('lists who can open the folder, newest first', async () => {
    service.guestsFor.mockResolvedValue([GUEST_ROW])

    const result = await listClientAccess(CLIENT_ID)

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({ email: 'buyer@acme.test', revokedAt: undefined, role: 'read' }),
      ],
    })
  })

  it('refuses when the account is not in an organization yet', async () => {
    guard.membershipOf.mockReturnValue({ organizationId: undefined })

    const result = await listClientAccess(CLIENT_ID)

    expect(result).toEqual({
      ok: false,
      message: 'Your account is not part of an organization yet.',
    })
  })
})

describe('listOrganizationAccess', () => {
  const PAGE_INFO = {
    page: 1,
    pageSize: 25,
    total: 1,
    pageCount: 1,
    hasPrevious: false,
    hasNext: false,
  }

  it('lists every grant the organization has handed out', async () => {
    service.organizationAccess.mockResolvedValue({
      rows: [{ id: GUEST_ID, email: 'buyer@acme.test', clientName: 'Acme' }],
      pageInfo: PAGE_INFO,
    })

    const result = await listOrganizationAccess({ view: 'all' })

    expect(service.organizationAccess).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ view: 'all' }),
    )
    expect(result).toMatchObject({ ok: true, pageInfo: PAGE_INFO })
  })

  it('refuses a member who cannot manage the organization', async () => {
    guard.canManageOrganization.mockReturnValue(false)

    const result = await listOrganizationAccess()

    expect(result).toEqual({ ok: false, message: 'Only an admin can see every folder grant.' })
    expect(service.organizationAccess).not.toHaveBeenCalled()
  })

  it('falls back to the default view rather than throwing on a hand-edited URL', async () => {
    service.organizationAccess.mockResolvedValue({ rows: [], pageInfo: PAGE_INFO })

    await listOrganizationAccess({ view: 'nonsense', page: 0 })

    expect(service.organizationAccess).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ view: 'active', page: 1 }),
    )
  })
})

describe('shareClientFolder in link mode', () => {
  beforeEach(() => {
    process.env.GRAPH_SHARE_MODE = 'link'
  })

  afterEach(() => {
    delete process.env.GRAPH_SHARE_MODE
  })

  it('creates an anonymous link and invites nobody', async () => {
    const result = await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    expect(graph.inviteGuest).not.toHaveBeenCalled()
    expect(graph.shareItem).not.toHaveBeenCalled()
    expect(graph.createLink).toHaveBeenCalledWith(
      'client-drive',
      'folder-1',
      expect.objectContaining({ scope: 'anonymous', type: 'view' }),
    )
    expect(service.saveGuest).toHaveBeenCalledWith(
      expect.objectContaining({ permissionId: 'perm-link-1', invitedUserId: undefined }),
    )
    expect(result.ok).toBe(true)
  })

  it('mails the link itself and says it opens without a sign-in', async () => {
    await shareClientFolder({ clientId: CLIENT_ID, email: 'buyer@acme.test' })

    const sent = mail.sendEmail.mock.calls[0]?.[0] as { html: string }
    expect(sent.html).toContain('https://sharepoint.test/:f:/s/ihp-clients/anon')
    expect(sent.html).toContain('without a sign-in')
  })
})

describe('createClientGroup', () => {
  it('makes the group folder at the library root, refusing to adopt one already there', async () => {
    const result = await createClientGroup({ name: '  Smith Holdings ' })

    expect(graph.createFolder).toHaveBeenCalledWith(
      'client-drive',
      'client-drive-root',
      'Smith Holdings',
    )
    expect(graph.ensureFolder).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, data: { id: GROUP_ID, members: [] } })
  })

  it('refuses a name a client already has, because their folders share the root', async () => {
    service.clientByFolderName.mockResolvedValueOnce({ id: CLIENT_ID, name: 'Smith Holdings' })

    const result = await createClientGroup({ name: 'Smith Holdings' })

    expect(result).toEqual({
      ok: false,
      message: 'A client already has that name — give the group another one.',
    })
    expect(graph.createFolder).not.toHaveBeenCalled()
  })

  it('says the library already has that folder when Graph answers 409', async () => {
    graph.createFolder.mockRejectedValueOnce(new TestGraphError(409, 'nameAlreadyExists', 'Taken.'))

    const result = await createClientGroup({ name: 'Smith Holdings' })

    expect(result).toEqual({
      ok: false,
      message: 'The client library already has a folder with that name — pick another one.',
    })
    expect(service.saveGroup).not.toHaveBeenCalled()
  })

  it('is refused to a member who cannot manage the organization', async () => {
    guard.canManageOrganization.mockReturnValue(false)

    const result = await createClientGroup({ name: 'Smith Holdings' })

    expect(result).toEqual({ ok: false, message: 'Only an admin can manage client groups.' })
  })
})

describe('addClientToGroup', () => {
  it('moves an existing company folder under the group, keeping its item id', async () => {
    service.clientDriveFolder.mockResolvedValue({
      driveId: 'client-drive',
      itemId: 'folder-1',
      groupId: null,
    })

    const result = await addClientToGroup({ groupId: GROUP_ID, clientId: CLIENT_ID })

    expect(graph.moveItem).toHaveBeenCalledWith('client-drive', 'folder-1', 'group-folder')
    expect(service.moveClientDriveFolder).toHaveBeenCalledWith(CLIENT_ID, {
      groupId: GROUP_ID,
      webUrl: 'https://sharepoint.test/Smith/Acme',
    })
    expect(result).toEqual({ ok: true, data: null })
  })

  it('makes the company folder inside the group when it has none yet', async () => {
    await addClientToGroup({ groupId: GROUP_ID, clientId: CLIENT_ID })

    expect(graph.moveItem).not.toHaveBeenCalled()
    expect(graph.ensureFolder).toHaveBeenLastCalledWith('client-drive', 'group-folder', 'Acme')
    expect(service.saveClientDriveFolder).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: CLIENT_ID, groupId: GROUP_ID, itemId: 'folder-1' }),
    )
  })

  it('does nothing when the company is already in that group', async () => {
    service.clientDriveFolder.mockResolvedValue({
      driveId: 'client-drive',
      itemId: 'folder-1',
      groupId: GROUP_ID,
    })

    await addClientToGroup({ groupId: GROUP_ID, clientId: CLIENT_ID })

    expect(graph.moveItem).not.toHaveBeenCalled()
  })

  it('refuses a group from another organization', async () => {
    service.groupFor.mockResolvedValue(null)

    const result = await addClientToGroup({ groupId: GROUP_ID, clientId: CLIENT_ID })

    expect(result).toEqual({ ok: false, message: 'That group no longer exists.' })
    expect(graph.moveItem).not.toHaveBeenCalled()
  })

  it('repeats Microsoft’s reason when the move is refused', async () => {
    service.clientDriveFolder.mockResolvedValue({
      driveId: 'client-drive',
      itemId: 'folder-1',
      groupId: null,
    })
    graph.moveItem.mockRejectedValueOnce(
      new TestGraphError(409, 'nameAlreadyExists', 'A folder named Acme is already there.'),
    )

    const result = await addClientToGroup({ groupId: GROUP_ID, clientId: CLIENT_ID })

    expect(result).toEqual({
      ok: false,
      message: 'Microsoft refused that (nameAlreadyExists) — A folder named Acme is already there.',
    })
    expect(service.moveClientDriveFolder).not.toHaveBeenCalled()
  })
})

describe('removeClientFromGroup', () => {
  it('moves the company folder back to the library root', async () => {
    service.clientDriveFolder.mockResolvedValue({
      driveId: 'client-drive',
      itemId: 'folder-1',
      groupId: GROUP_ID,
    })

    const result = await removeClientFromGroup({ groupId: GROUP_ID, clientId: CLIENT_ID })

    expect(graph.moveItem).toHaveBeenCalledWith('client-drive', 'folder-1', 'client-drive-root')
    expect(service.moveClientDriveFolder).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ groupId: null }),
    )
    expect(result.ok).toBe(true)
  })

  it('leaves a folder alone that is not in that group', async () => {
    service.clientDriveFolder.mockResolvedValue({
      driveId: 'client-drive',
      itemId: 'folder-1',
      groupId: null,
    })

    await removeClientFromGroup({ groupId: GROUP_ID, clientId: CLIENT_ID })

    expect(graph.moveItem).not.toHaveBeenCalled()
  })
})

describe('deleteClientGroup', () => {
  it('refuses while companies are still in it, so no documents go with it', async () => {
    service.groupMemberCount.mockResolvedValueOnce(2)

    const result = await deleteClientGroup(GROUP_ID)

    expect(result).toEqual({
      ok: false,
      message: 'Take every company out of the group before deleting it.',
    })
    expect(graph.deleteItem).not.toHaveBeenCalled()
  })

  it('deletes the empty folder, marks its grants removed and archives the group', async () => {
    service.groupGuestsFor.mockResolvedValueOnce([
      { ...GUEST_ROW, groupId: GROUP_ID },
      { ...GUEST_ROW, id: 'old', groupId: GROUP_ID, revokedAt: new Date() },
    ])

    const result = await deleteClientGroup(GROUP_ID)

    expect(graph.deleteItem).toHaveBeenCalledWith('client-drive', 'group-folder')
    expect(service.markGuestRevoked).toHaveBeenCalledTimes(1)
    expect(service.markGuestRevoked).toHaveBeenCalledWith(GUEST_ID)
    expect(service.archiveGroup).toHaveBeenCalledWith(GROUP_ID)
    expect(result.ok).toBe(true)
  })

  it('still archives when the folder was already deleted in SharePoint', async () => {
    graph.deleteItem.mockRejectedValueOnce(new TestGraphError(404, 'itemNotFound', 'Gone.'))

    const result = await deleteClientGroup(GROUP_ID)

    expect(service.archiveGroup).toHaveBeenCalledWith(GROUP_ID)
    expect(result.ok).toBe(true)
  })
})

describe('shareGroupFolder', () => {
  it('shares the group folder once and mails the link under the group’s name', async () => {
    const result = await shareGroupFolder({ groupId: GROUP_ID, email: 'Owner@Smith.test' })

    expect(graph.shareItem).toHaveBeenCalledWith(
      'client-drive',
      'group-folder',
      ['owner@smith.test'],
      'read',
    )
    expect(service.saveGroupGuest).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: GROUP_ID, email: 'owner@smith.test' }),
    )
    const sent = mail.sendEmail.mock.calls[0]?.[0] as { html: string }
    expect(sent.html).toContain('Smith Holdings')
    expect(result.ok).toBe(true)
  })

  it('grants nothing when Microsoft refuses the address', async () => {
    graph.shareItem.mockResolvedValueOnce({
      granted: [],
      failed: [{ email: 'owner@smith.test', message: 'External sharing is off for this site.' }],
    })

    const result = await shareGroupFolder({ groupId: GROUP_ID, email: 'owner@smith.test' })

    expect(result).toEqual({
      ok: false,
      message: 'Microsoft refused that address — External sharing is off for this site.',
    })
    expect(service.saveGroupGuest).not.toHaveBeenCalled()
  })
})

describe('revokeClientFolderAccess on a group grant', () => {
  it('deletes the permission from the group folder', async () => {
    service.guestById.mockResolvedValue({ ...GUEST_ROW, clientId: null, groupId: GROUP_ID })

    const result = await revokeClientFolderAccess(GUEST_ID)

    expect(graph.revokePermission).toHaveBeenCalledWith('client-drive', 'group-folder', 'perm-1')
    expect(result.ok).toBe(true)
  })
})

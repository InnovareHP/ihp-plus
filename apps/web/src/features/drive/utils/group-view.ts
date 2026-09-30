import type { ClientGroupRow, ClientGroupsView } from '../schema'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

export function withGroup(view: ClientGroupsView, group: ClientGroupRow): ClientGroupsView {
  return {
    ...view,
    groups: [...view.groups.filter((row) => row.id !== group.id), group].sort(byName),
  }
}

export function withoutGroup(view: ClientGroupsView, groupId: string): ClientGroupsView {
  return { ...view, groups: view.groups.filter((group) => group.id !== groupId) }
}

/** A company sits in one group at most, so joining one takes it out of any other. */
export function withMember(
  view: ClientGroupsView,
  groupId: string,
  clientId: string,
): ClientGroupsView {
  const client = view.clients.find((row) => row.id === clientId)
  if (!client) return view
  const cleared = withoutMember(view, clientId)

  return {
    clients: cleared.clients.map((row) => (row.id === clientId ? { ...row, groupId } : row)),
    groups: cleared.groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            members: [...group.members, { id: client.id, name: client.name }].sort(byName),
          }
        : group,
    ),
  }
}

export function withoutMember(view: ClientGroupsView, clientId: string): ClientGroupsView {
  return {
    clients: view.clients.map((row) =>
      row.id === clientId ? { ...row, groupId: undefined } : row,
    ),
    groups: view.groups.map((group) => ({
      ...group,
      members: group.members.filter((member) => member.id !== clientId),
    })),
  }
}

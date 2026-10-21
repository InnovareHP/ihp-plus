import { CLIENT_STATUS_LABELS, CLIENT_STATUSES, type ClientStatus } from '@/features/clients/schema'
import { routes } from '@/lib/routes'
import type { SearchClient, SearchEntry, SearchPerson } from '../schema'

// The pages already filter on ?search=, so a result opens on the right row until deep links land.
function filtered(page: string, name: string) {
  return `${page}?search=${encodeURIComponent(name)}`
}

function statusLabel(status: string) {
  return (CLIENT_STATUSES as readonly string[]).includes(status)
    ? CLIENT_STATUS_LABELS[status as ClientStatus]
    : undefined
}

export function personEntries(people: readonly SearchPerson[]): SearchEntry[] {
  return people.map((person) => ({
    id: `person:${person.userId}`,
    kind: 'person',
    label: person.name,
    description: person.jobTitle || undefined,
    area: person.department || undefined,
    href: filtered(routes.directory, person.name),
    keywords: [person.department, person.jobTitle].filter(Boolean),
    photoUrl: person.photoUrl || undefined,
  }))
}

export function clientEntries(clients: readonly SearchClient[]): SearchEntry[] {
  return clients.map((client) => ({
    id: `client:${client.clientId}`,
    kind: 'client',
    label: client.name,
    description: 'Client',
    area: statusLabel(client.status),
    href: filtered(routes.clients, client.name),
    keywords: [statusLabel(client.status) ?? client.status],
  }))
}

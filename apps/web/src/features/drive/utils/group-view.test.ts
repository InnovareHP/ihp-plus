import { describe, expect, it } from 'vitest'
import type { ClientGroupsView } from '../schema'
import { withGroup, withMember, withoutGroup, withoutMember } from './group-view'

const VIEW: ClientGroupsView = {
  groups: [
    { id: 'g1', name: 'Smith Holdings', webUrl: undefined, activeGrants: 0, members: [] },
    {
      id: 'g2',
      name: 'Tan Group',
      webUrl: undefined,
      activeGrants: 1,
      members: [{ id: 'c2', name: 'Beta' }],
    },
  ],
  clients: [
    { id: 'c1', name: 'Acme', groupId: undefined },
    { id: 'c2', name: 'Beta', groupId: 'g2' },
  ],
}

describe('group view', () => {
  it('adds a company to a group and marks it grouped', () => {
    const next = withMember(VIEW, 'g1', 'c1')

    expect(next.groups[0]?.members).toEqual([{ id: 'c1', name: 'Acme' }])
    expect(next.clients[0]?.groupId).toBe('g1')
  })

  it('takes a company out of its old group when it joins another', () => {
    const next = withMember(VIEW, 'g1', 'c2')

    expect(next.groups[1]?.members).toEqual([])
    expect(next.groups[0]?.members).toEqual([{ id: 'c2', name: 'Beta' }])
  })

  it('removes a company from every group', () => {
    const next = withoutMember(VIEW, 'c2')

    expect(next.groups[1]?.members).toEqual([])
    expect(next.clients[1]?.groupId).toBeUndefined()
  })

  it('keeps groups in name order when one is added', () => {
    const next = withGroup(VIEW, {
      id: 'g3',
      name: 'Alder',
      webUrl: undefined,
      activeGrants: 0,
      members: [],
    })

    expect(next.groups.map((group) => group.name)).toEqual(['Alder', 'Smith Holdings', 'Tan Group'])
  })

  it('drops a deleted group', () => {
    expect(withoutGroup(VIEW, 'g1').groups.map((group) => group.id)).toEqual(['g2'])
  })
})

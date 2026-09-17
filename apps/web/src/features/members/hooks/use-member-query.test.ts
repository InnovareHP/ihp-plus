import { describe, expect, it } from 'vitest'
import { DEFAULT_MEMBER_QUERY } from '../schema'
import { memberQueryHref, parseMemberQuery } from './use-member-query'

const parse = (search: string) => parseMemberQuery(new URLSearchParams(search))

describe('parseMemberQuery', () => {
  it('defaults everything when the URL is bare', () => {
    expect(parse('')).toEqual(DEFAULT_MEMBER_QUERY)
  })

  it('reads a multi-value filter written either way', () => {
    expect(parse('portalRoles=admin,user').portalRoles).toEqual(['admin', 'user'])
    expect(parse('portalRoles=admin&portalRoles=user').portalRoles).toEqual(['admin', 'user'])
  })

  it('drops a filter value the server does not accept', () => {
    expect(parse('organizationRoles=owner,superuser').organizationRoles).toEqual(['owner'])
    expect(parse('status=deleted').status).toBe('all')
    expect(parse('sortBy=salary&sortDirection=sideways')).toMatchObject({
      sortBy: 'name',
      sortDirection: 'asc',
    })
  })

  it('keeps a start-date window only in the format the query builder expects', () => {
    expect(parse('startDateFrom=2026-01-01&startDateTo=nonsense')).toMatchObject({
      startDateFrom: '2026-01-01',
      startDateTo: undefined,
    })
  })

  it('caps the number of department ids one URL can ask for', () => {
    const ids = Array.from({ length: 80 }, (_, index) => `team-${index}`)
    expect(parse(`teamIds=${ids.join(',')}`).teamIds).toHaveLength(50)
  })
})

describe('memberQueryHref', () => {
  it('writes only what differs from the defaults', () => {
    expect(memberQueryHref('/organization/members', DEFAULT_MEMBER_QUERY)).toBe(
      '/organization/members',
    )
  })

  it('round-trips a filtered, sorted page', () => {
    const query = {
      ...DEFAULT_MEMBER_QUERY,
      page: 3,
      search: 'ada',
      status: 'suspended' as const,
      teamIds: ['team-1', 'team-2'],
      sortBy: 'startDate' as const,
      sortDirection: 'desc' as const,
    }
    const href = memberQueryHref('/organization/members', query)

    expect(parse(href.split('?')[1] ?? '')).toEqual(query)
  })
})

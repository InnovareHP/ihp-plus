import { describe, expect, it } from 'vitest'
import { routes } from '@/lib/routes'
import { clientEntries, personEntries } from './directory-entries'

describe('personEntries', () => {
  it('turns a person into a result that opens the directory filtered to them', () => {
    const [grace] = personEntries([
      {
        userId: 'user-2',
        name: 'Grace Hopper',
        jobTitle: 'Recruiter',
        department: 'HR',
        photoUrl: '/api/people/user-2/photo?v=1',
      },
    ])

    expect(grace).toEqual({
      id: 'person:user-2',
      kind: 'person',
      label: 'Grace Hopper',
      description: 'Recruiter',
      area: 'HR',
      href: `${routes.directory}?search=Grace%20Hopper`,
      keywords: ['HR', 'Recruiter'],
      photoUrl: '/api/people/user-2/photo?v=1',
    })
  })

  it('leaves out what a person has not filled in, rather than showing blanks', () => {
    const [zoe] = personEntries([
      { userId: 'user-3', name: 'Zoe Park', jobTitle: '', department: '', photoUrl: '' },
    ])

    expect(zoe).toMatchObject({ description: undefined, area: undefined, photoUrl: undefined })
    expect(zoe?.keywords).toEqual([])
  })
})

describe('clientEntries', () => {
  it('labels the status as the clients page does', () => {
    const [acme] = clientEntries([{ clientId: 'client-1', name: 'Acme & Co', status: 'on_hold' }])

    expect(acme).toMatchObject({
      id: 'client:client-1',
      kind: 'client',
      area: 'On hold',
      href: `${routes.clients}?search=Acme%20%26%20Co`,
    })
  })

  it('shows no badge for a status it does not know', () => {
    const [odd] = clientEntries([{ clientId: 'client-2', name: 'Odd', status: 'archived?' }])

    expect(odd?.area).toBeUndefined()
  })
})

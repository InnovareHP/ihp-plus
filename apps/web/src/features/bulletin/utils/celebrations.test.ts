import { describe, expect, it } from 'vitest'
import { DEFAULT_BULLETIN_SETTINGS } from '../schema'
import { dueCelebrations, type CelebrationPerson } from './celebrations'

const NOW = new Date('2026-09-26T01:00:00.000Z')

function person(overrides: Partial<CelebrationPerson> = {}): CelebrationPerson {
  return {
    userId: 'user-1',
    name: 'Ada',
    dateOfBirth: null,
    startDate: null,
    onboardingCompletedAt: null,
    ...overrides,
  }
}

describe('dueCelebrations', () => {
  it('wishes a happy birthday on the day, without the age', () => {
    const due = dueCelebrations(
      [person({ dateOfBirth: new Date('1990-09-26T00:00:00.000Z') })],
      DEFAULT_BULLETIN_SETTINGS,
      '2026-09-26',
      NOW,
    )

    expect(due).toEqual([
      expect.objectContaining({ kind: 'birthday', occasionKey: 'birthday:user-1:2026' }),
    ])
    expect(due[0]?.body).toContain('Ada')
    expect(due[0]?.body).not.toContain('36')
  })

  it('marks a 29 February birthday on the 28th outside a leap year', () => {
    const leapling = person({ dateOfBirth: new Date('2000-02-29T00:00:00.000Z') })

    expect(dueCelebrations([leapling], DEFAULT_BULLETIN_SETTINGS, '2026-02-28', NOW)).toHaveLength(
      1,
    )
    expect(dueCelebrations([leapling], DEFAULT_BULLETIN_SETTINGS, '2028-02-28', NOW)).toHaveLength(
      0,
    )
    expect(dueCelebrations([leapling], DEFAULT_BULLETIN_SETTINGS, '2028-02-29', NOW)).toHaveLength(
      1,
    )
  })

  it('counts whole years for a work anniversary and skips the start day itself', () => {
    const hired = person({ startDate: new Date('2023-09-26T00:00:00.000Z') })

    const [anniversary] = dueCelebrations([hired], DEFAULT_BULLETIN_SETTINGS, '2026-09-26', NOW)
    expect(anniversary).toMatchObject({
      kind: 'anniversary',
      occasionKey: 'anniversary:user-1:2026',
    })
    expect(anniversary?.body).toContain('3-year')

    const firstDay = person({ startDate: new Date('2026-09-26T00:00:00.000Z') })
    expect(dueCelebrations([firstDay], DEFAULT_BULLETIN_SETTINGS, '2026-09-26', NOW)).toEqual([])
  })

  it('welcomes a recent new hire once, keyed by person rather than date', () => {
    const recent = person({ onboardingCompletedAt: new Date('2026-09-25T10:00:00.000Z') })
    const longAgo = person({
      userId: 'user-2',
      onboardingCompletedAt: new Date('2026-08-01T10:00:00.000Z'),
    })

    expect(
      dueCelebrations([recent, longAgo], DEFAULT_BULLETIN_SETTINGS, '2026-09-26', NOW),
    ).toEqual([expect.objectContaining({ kind: 'welcome', occasionKey: 'welcome:user-1' })])
  })

  it('posts nothing an admin switched off', () => {
    const everything = person({
      dateOfBirth: new Date('1990-09-26T00:00:00.000Z'),
      startDate: new Date('2020-09-26T00:00:00.000Z'),
      onboardingCompletedAt: new Date('2026-09-25T10:00:00.000Z'),
    })

    expect(
      dueCelebrations(
        [everything],
        { celebrateBirthdays: false, celebrateAnniversaries: false, welcomeNewHires: false },
        '2026-09-26',
        NOW,
      ),
    ).toEqual([])
  })
})

import type { BulletinSettingsRow, CelebrationKind } from '../schema'

export interface CelebrationPerson {
  userId: string
  name: string
  dateOfBirth: Date | null
  startDate: Date | null
  onboardingCompletedAt: Date | null
}

export interface DueCelebration {
  kind: CelebrationKind
  subjectUserId: string
  occasionKey: string
  body: string
}

/** Someone who finished onboarding this recently is still new enough to welcome. */
export const WELCOME_WINDOW_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// Dates of birth and start dates are stored as calendar dates at UTC midnight, so the UTC parts
// are the date itself; a 29 February birthday is marked on the 28th in other years.
function falls(on: Date, today: string) {
  const year = Number(today.slice(0, 4))
  const monthDay = on.toISOString().slice(5, 10)
  const observed = monthDay === '02-29' && !isLeapYear(year) ? '02-28' : monthDay
  return observed === today.slice(5, 10)
}

/**
 * Every celebration that belongs on the board today, keyed so posting them twice is impossible.
 * `today` is YYYY-MM-DD in the organization's own zone, so midnight is theirs, not the server's.
 */
export function dueCelebrations(
  people: readonly CelebrationPerson[],
  settings: BulletinSettingsRow,
  today: string,
  now: Date,
): DueCelebration[] {
  const year = Number(today.slice(0, 4))

  return people.flatMap((person) => {
    const due: DueCelebration[] = []

    if (settings.celebrateBirthdays && person.dateOfBirth && falls(person.dateOfBirth, today)) {
      due.push({
        kind: 'birthday',
        subjectUserId: person.userId,
        occasionKey: `birthday:${person.userId}:${year}`,
        body: `Happy birthday, ${person.name}! 🎂 Wishing you a wonderful year ahead.`,
      })
    }

    if (settings.celebrateAnniversaries && person.startDate && falls(person.startDate, today)) {
      const years = year - person.startDate.getUTCFullYear()
      if (years >= 1) {
        due.push({
          kind: 'anniversary',
          subjectUserId: person.userId,
          occasionKey: `anniversary:${person.userId}:${year}`,
          body: `Happy ${years}-year work anniversary, ${person.name}! 🎉 Thank you for everything you bring to the team.`,
        })
      }
    }

    const onboarded = person.onboardingCompletedAt
    if (
      settings.welcomeNewHires &&
      onboarded &&
      now.getTime() - onboarded.getTime() <= WELCOME_WINDOW_DAYS * DAY_MS
    ) {
      due.push({
        kind: 'welcome',
        subjectUserId: person.userId,
        // Once per person ever: nobody is new twice.
        occasionKey: `welcome:${person.userId}`,
        body: `Please welcome ${person.name} to the team! 👋 Say hello in the replies.`,
      })
    }

    return due
  })
}

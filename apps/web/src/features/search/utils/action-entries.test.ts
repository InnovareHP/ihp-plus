import { describe, expect, it } from 'vitest'
import { newRequestRoute, routes } from '@/lib/routes'
import { actionEntries, THEME_ACTION_ID } from './action-entries'

const EVERY_PAGE = new Set([routes.tasks, routes.clients, routes.attendance, routes.requests])
const LEAVE = { id: 'form-1', name: 'Leave', timeOff: true }
const EQUIPMENT = { id: 'form-2', name: 'Equipment', timeOff: false }

function labels(visibleHrefs: ReadonlySet<string>, forms = [LEAVE]) {
  return actionEntries({ visibleHrefs, forms, nextTheme: 'dark' }).map((one) => one.label)
}

describe('actionEntries', () => {
  it('offers each shortcut, going to a screen rather than acting in place', () => {
    const actions = actionEntries({ visibleHrefs: EVERY_PAGE, forms: [LEAVE], nextTheme: 'dark' })

    expect(actions.map((one) => [one.label, one.href])).toEqual([
      ['New task', `${routes.tasks}?compose=new`],
      ['New client', `${routes.clients}?compose=new`],
      ['Clock in or out', routes.attendance],
      ['New request: Leave', newRequestRoute('form-1')],
      ['Switch to dark theme', routes.settings],
    ])
    expect(actions.every((one) => one.kind === 'action')).toBe(true)
  })

  it('offers only what the sidebar shows this person', () => {
    expect(labels(new Set([routes.attendance]))).toEqual([
      'Clock in or out',
      'Switch to dark theme',
    ])
  })

  it('names each request form, and finds a time-off form by "leave" or "vacation"', () => {
    const actions = actionEntries({
      visibleHrefs: EVERY_PAGE,
      forms: [LEAVE, EQUIPMENT],
      nextTheme: 'light',
    })
    const leave = actions.find((one) => one.label === 'New request: Leave')

    expect(leave?.keywords).toEqual(expect.arrayContaining(['leave', 'vacation']))
    expect(actions.some((one) => one.label === 'New request: Equipment')).toBe(true)
  })

  it('names the theme it switches to', () => {
    const theme = actionEntries({ visibleHrefs: new Set(), forms: [], nextTheme: 'light' })

    expect(theme).toEqual([
      expect.objectContaining({ id: THEME_ACTION_ID, label: 'Switch to light theme' }),
    ])
  })
})

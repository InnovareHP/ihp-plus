import { newRequestRoute, routes } from '@/lib/routes'
import type { SearchEntry } from '../schema'

/** Runs in place rather than navigating, so the palette handles it by id. */
export const THEME_ACTION_ID = 'action:theme'

export interface ActionSources {
  /** Paths the sidebar shows this person; an action is only offered where its page is. */
  visibleHrefs: ReadonlySet<string>
  forms: readonly { id: string; name: string; timeOff: boolean }[]
  nextTheme: 'light' | 'dark'
}

/**
 * Shortcuts that go to a screen with the work started, never doing it in place: clocking in
 * may need a photo, and a stray Enter must not file anything.
 */
export function actionEntries({ visibleHrefs, forms, nextTheme }: ActionSources): SearchEntry[] {
  const actions: SearchEntry[] = []

  if (visibleHrefs.has(routes.tasks)) {
    actions.push({
      id: 'action:new-task',
      kind: 'action',
      label: 'New task',
      description: 'Open the task board with a new task started',
      area: 'Tasks',
      href: `${routes.tasks}?compose=new`,
      keywords: ['add', 'create', 'todo'],
    })
  }

  if (visibleHrefs.has(routes.clients)) {
    actions.push({
      id: 'action:new-client',
      kind: 'action',
      label: 'New client',
      description: 'Open the clients page with a new client started',
      area: 'Clients',
      href: `${routes.clients}?compose=new`,
      keywords: ['add', 'create', 'account'],
    })
  }

  if (visibleHrefs.has(routes.attendance)) {
    actions.push({
      id: 'action:clock',
      kind: 'action',
      label: 'Clock in or out',
      description: 'Go to the time clock to clock in, clock out or take a break',
      area: 'Time clock',
      href: routes.attendance,
      keywords: ['clock in', 'clock out', 'break', 'punch'],
    })
  }

  if (visibleHrefs.has(routes.requests)) {
    for (const form of forms) {
      actions.push({
        id: `action:request:${form.id}`,
        kind: 'action',
        label: `New request: ${form.name}`,
        description: form.timeOff ? 'Ask for time off' : 'Fill it in and send it for approval',
        area: 'Requests',
        href: newRequestRoute(form.id),
        keywords: form.timeOff ? ['leave', 'time off', 'vacation', 'holiday'] : ['request'],
      })
    }
  }

  actions.push({
    id: THEME_ACTION_ID,
    kind: 'action',
    label: `Switch to ${nextTheme} theme`,
    description: 'Change how the app looks on this device',
    area: 'Settings',
    href: routes.settings,
    keywords: ['theme', 'dark mode', 'light mode', 'appearance'],
  })

  return actions
}

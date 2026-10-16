import type { NavSection } from '@/lib/navigation'
import type { PageTab } from '@/lib/page-tabs'
import { routes } from '@/lib/routes'
import type { SearchEntry } from '../schema'

// Settings is left out of the sidebar on purpose, but people still look for it by name.
const SETTINGS: SearchEntry = {
  id: `page:${routes.settings}`,
  kind: 'page',
  label: 'Settings',
  description: 'Your profile, photo and password',
  href: routes.settings,
}

/** Every page the sidebar already shows this person, plus the tabs on those pages. */
export function pageEntries(
  sections: readonly NavSection[],
  tabs: readonly PageTab[],
): SearchEntry[] {
  const pages = sections.flatMap((section) =>
    section.items.flatMap((item): SearchEntry[] =>
      item.children
        ? item.children.map((child) => ({
            id: `page:${child.href}`,
            kind: 'page',
            label: child.label,
            description: child.description,
            area: item.label,
            href: child.href,
            keywords: [item.label, section.label],
          }))
        : [
            {
              id: `page:${item.href}`,
              kind: 'page',
              label: item.label,
              description: item.description,
              href: item.href,
              keywords: [section.label],
            },
          ],
    ),
  )

  const visible = new Map(pages.map((page) => [page.href, page]))
  const tabEntries = tabs.flatMap((tab): SearchEntry[] => {
    const page = visible.get(tab.page)
    if (!page) return []
    return [
      {
        id: `page:${tab.href}`,
        kind: 'page',
        label: tab.label,
        description: page.description,
        area: page.label,
        href: tab.href,
        keywords: [page.label, ...(page.keywords ?? [])],
      },
    ]
  })

  return [...pages, ...tabEntries, SETTINGS]
}

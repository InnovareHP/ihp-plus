import { IconSettings, type Icon } from '@tabler/icons-react'
import type { NavSection } from '@/lib/navigation'
import { routes } from '@/lib/routes'

/** The sidebar icon for each page path, so a result looks like the row it leads to. */
export function pageIcons(sections: readonly NavSection[]) {
  const icons = new Map<string, Icon>([[routes.settings, IconSettings]])
  for (const section of sections) {
    for (const item of section.items) {
      icons.set(item.href, item.icon)
      for (const child of item.children ?? []) icons.set(child.href, item.icon)
    }
  }
  return icons
}

/** Tabs live at their page's path plus a query string, so the path alone finds the icon. */
export function iconFor(icons: ReadonlyMap<string, Icon>, href: string) {
  return icons.get(href.split('?')[0] ?? href)
}

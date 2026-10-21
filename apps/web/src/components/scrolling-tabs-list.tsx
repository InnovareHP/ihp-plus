'use client'

import { Tabs, type TabsListProps } from '@mantine/core'
import { useEffect, useRef } from 'react'

/** A tab list that brings the open tab into view when the row scrolls sideways on a phone. */
export function ScrollingTabsList(props: TabsListProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Synchronises the list's scroll position, a browser value, with whichever tab is open.
  useEffect(() => {
    const list = ref.current
    const active = list?.querySelector<HTMLElement>('[data-active]')
    if (!list || !active) return
    const start =
      active.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft
    if (
      start < list.scrollLeft ||
      start + active.offsetWidth > list.scrollLeft + list.clientWidth
    ) {
      list.scrollLeft = start - 16
    }
  })

  return <Tabs.List ref={ref} {...props} />
}

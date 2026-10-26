import type { TaskRow } from '../schema'

/**
 * A column is a status and a card keeps its list, so the row a card lands before is the next one
 * from its own list — ordering a column never shuffles a list the user cannot see.
 */
export function beforeInList(items: readonly TaskRow[], from: number, listId: string) {
  return items.slice(from).find((item) => item.listId === listId)?.id
}

/** Where a dropped card lands, read from its shown neighbours since "Show more" may hide the rest. */
export function beforeTaskIdFor(
  shownOrder: readonly string[],
  movingId: string,
  column: readonly TaskRow[],
  listId: string,
) {
  const rest = column.filter((item) => item.id !== movingId)
  const at = shownOrder.indexOf(movingId)
  const next = shownOrder[at + 1]
  const previous = shownOrder[at - 1]

  let position = rest.length
  if (next) {
    const index = rest.findIndex((item) => item.id === next)
    if (index !== -1) position = index
  } else if (previous) {
    const index = rest.findIndex((item) => item.id === previous)
    if (index !== -1) position = index + 1
  } else {
    position = 0
  }

  return beforeInList(rest, position, listId)
}

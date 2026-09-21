/** ⌘/Ctrl + Enter posts, because Enter alone belongs to the textarea. */
export function isSubmitShortcut(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
}): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
}

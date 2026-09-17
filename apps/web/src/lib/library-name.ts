/** SharePoint refuses these outright, and a leading or trailing dot breaks sync clients. */
const FORBIDDEN = /["*:<>?/\\|#%]/g

export function safeLibraryName(name: string, fallback = 'file') {
  const cleaned = name
    .replace(FORBIDDEN, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 200)

  return cleaned || fallback
}

/** Where the trail starts; the library root has no folder name of its own. */
export const LIBRARY_ROOT_LABEL = 'Internal library'

/** A `..` segment would climb out of the library, so a path is rebuilt from clean segments. */
export function librarySegments(path: string) {
  return path
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

export function normalizeLibraryPath(path: string) {
  return librarySegments(path).join('/')
}

export function joinLibraryPath(path: string, name: string) {
  return normalizeLibraryPath(`${path}/${name}`)
}

export function parentLibraryPath(path: string) {
  return librarySegments(path).slice(0, -1).join('/')
}

export interface LibraryCrumb {
  label: string
  path: string
}

/** Every ancestor of the folder being read, root first, so each one is one click away. */
export function libraryTrail(path: string): LibraryCrumb[] {
  const segments = librarySegments(path)
  return [
    { label: LIBRARY_ROOT_LABEL, path: '' },
    ...segments.map((segment, index) => ({
      label: segment,
      path: segments.slice(0, index + 1).join('/'),
    })),
  ]
}

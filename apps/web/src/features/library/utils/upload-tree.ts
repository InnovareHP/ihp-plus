/** One file to upload, and the folder under the open one it lands in ('' for the open one itself). */
export interface LibraryUpload {
  file: File
  folder: string
}

// Operating-system clutter that rides along with a dragged folder and nobody meant to share.
const JUNK = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])

function isJunk(name: string) {
  return JUNK.has(name.toLowerCase()) || name.startsWith('._')
}

function folderOf(relativePath: string) {
  return relativePath.split('/').slice(0, -1).join('/')
}

/** A folder picker reports each file's place in the tree through webkitRelativePath. */
export function uploadsFromFiles(files: File[]): LibraryUpload[] {
  return files
    .filter((file) => !isJunk(file.name))
    .map((file) => ({ file, folder: folderOf(file.webkitRelativePath ?? '') }))
}

function fileOf(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject))
}

/** readEntries answers in batches of about a hundred, so one call silently drops the rest. */
async function childrenOf(entry: FileSystemDirectoryEntry) {
  const reader = entry.createReader()
  const children: FileSystemEntry[] = []
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (batch.length === 0) return children
    children.push(...batch)
  }
}

async function walk(entry: FileSystemEntry, folder: string): Promise<LibraryUpload[]> {
  if (entry.isFile) {
    if (isJunk(entry.name)) return []
    return [{ file: await fileOf(entry as FileSystemFileEntry), folder }]
  }
  if (!entry.isDirectory) return []

  const inside = folder ? `${folder}/${entry.name}` : entry.name
  const children = await childrenOf(entry as FileSystemDirectoryEntry)
  const nested = await Promise.all(children.map((child) => walk(child, inside)))
  return nested.flat()
}

/** A drop can mix loose files with whole folders; folders are walked so their tree is kept. */
export async function uploadsFromDrop(transfer: DataTransfer): Promise<LibraryUpload[]> {
  // Entries must be taken synchronously: the DataTransfer is emptied once the handler yields.
  const entries = Array.from(transfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.() ?? null)

  if (entries.length === 0 || entries.some((entry) => entry === null)) {
    return uploadsFromFiles(Array.from(transfer.files)).map((upload) => ({ ...upload, folder: '' }))
  }

  const nested = await Promise.all(entries.map((entry) => walk(entry as FileSystemEntry, '')))
  return nested.flat()
}

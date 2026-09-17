import type { EventName } from '@/lib/analytics'

export const libraryEvents = {
  browsed: 'library.folder.browsed',
  browseFailed: 'library.folder.browse_failed',
  opened: 'library.file.opened',
  openFailed: 'library.file.open_failed',
  uploaded: 'library.file.uploaded',
  uploadFailed: 'library.file.upload_failed',
  folderCreated: 'library.folder.created',
  folderCreateFailed: 'library.folder.create_failed',
  renamed: 'library.item.renamed',
  renameFailed: 'library.item.rename_failed',
  deleted: 'library.item.deleted',
  deleteFailed: 'library.item.delete_failed',
  mirrorFailed: 'library.mirror.failed',
} as const satisfies Record<string, EventName>

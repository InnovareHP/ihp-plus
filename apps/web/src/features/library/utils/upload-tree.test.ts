import { describe, expect, it } from 'vitest'
import { uploadsFromDrop, uploadsFromFiles } from './upload-tree'

function picked(name: string, relativePath: string) {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

function fileEntry(name: string) {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (done: (file: File) => void) => done(new File(['x'], name)),
  }
}

function folderEntry(name: string, children: unknown[]) {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => {
      // Two batches then an empty one, the way browsers page a large folder.
      const batches = [children.slice(0, 1), children.slice(1), []]
      return { readEntries: (done: (entries: unknown[]) => void) => done(batches.shift() ?? []) }
    },
  }
}

function transferOf(entries: unknown[]) {
  return {
    items: entries.map((entry) => ({ kind: 'file', webkitGetAsEntry: () => entry })),
    files: [],
  } as unknown as DataTransfer
}

const shape = (uploads: { file: File; folder: string }[]) =>
  uploads.map((upload) => [upload.file.name, upload.folder])

describe('uploadsFromFiles', () => {
  it('keeps each picked file in its folder and drops OS clutter', () => {
    const uploads = uploadsFromFiles([
      picked('a.png', 'Photos/2026/a.png'),
      picked('.DS_Store', 'Photos/.DS_Store'),
      picked('loose.pdf', ''),
    ])

    expect(shape(uploads)).toEqual([
      ['a.png', 'Photos/2026'],
      ['loose.pdf', ''],
    ])
  })
})

describe('uploadsFromDrop', () => {
  it('walks a dropped folder, every batch of it, alongside loose files', async () => {
    const tree = folderEntry('Photos', [
      fileEntry('a.png'),
      folderEntry('Q1', [fileEntry('b.png'), fileEntry('Thumbs.db')]),
    ])

    const uploads = await uploadsFromDrop(transferOf([tree, fileEntry('loose.pdf')]))

    expect(shape(uploads)).toEqual([
      ['a.png', 'Photos'],
      ['b.png', 'Photos/Q1'],
      ['loose.pdf', ''],
    ])
  })

  it('falls back to the flat file list when the browser offers no entries', async () => {
    const transfer = {
      items: [{ kind: 'file', webkitGetAsEntry: () => null }],
      files: [new File(['x'], 'a.png')],
    } as unknown as DataTransfer

    expect(shape(await uploadsFromDrop(transfer))).toEqual([['a.png', '']])
  })
})

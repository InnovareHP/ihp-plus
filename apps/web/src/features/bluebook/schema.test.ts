import { describe, expect, it } from 'vitest'
import {
  bluebookQuerySchema,
  documentDraftSchema,
  COMPANY_SHELF,
  EMPTY_DOCUMENT_DRAFT,
  fileProblem,
  formatBytes,
  isFilteredBluebookQuery,
  MAX_UPLOAD_BYTES,
} from './schema'

const file = (patch: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: 'handbook.pdf',
  size: 2048,
  type: 'application/pdf',
  ...patch,
})

describe('fileProblem', () => {
  it('accepts the formats a handbook is made of', () => {
    expect(fileProblem(file())).toBeUndefined()
    expect(fileProblem(file({ type: 'image/png' }))).toBeUndefined()
    expect(
      fileProblem(
        file({
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      ),
    ).toBeUndefined()
  })

  it('refuses anything else by name, not by silence', () => {
    expect(fileProblem(file({ type: 'application/x-msdownload' }))).toBe(
      'Upload a PDF, Office document, text file or image.',
    )
  })

  it('refuses an empty file and one past the proxy limit', () => {
    expect(fileProblem(file({ size: 0 }))).toBe('That file is empty.')
    expect(fileProblem(file({ size: MAX_UPLOAD_BYTES + 1 }))).toBe(
      'Files have to be 25 MB or smaller.',
    )
    expect(fileProblem(file({ size: MAX_UPLOAD_BYTES }))).toBeUndefined()
  })
})

describe('formatBytes', () => {
  it('reads as a person would say it', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
  })
})

describe('documentDraftSchema', () => {
  const draft = (patch: Record<string, unknown> = {}) =>
    documentDraftSchema.safeParse({ ...EMPTY_DOCUMENT_DRAFT, title: 'Time-off policy', ...patch })

  it('needs a title and somewhere to file it', () => {
    expect(draft().success).toBe(true)
    expect(draft({ title: 'T' }).error?.issues[0]?.message).toBe('Give the document a title.')
    expect(draft({ shelves: [] }).error?.issues[0]?.message).toBe('Choose at least one department.')
  })

  it('files one document on several department shelves', () => {
    expect(draft({ shelves: ['team-1', 'team-2'] }).data?.shelves).toEqual(['team-1', 'team-2'])
  })

  it('drops a department repeated by a double click', () => {
    expect(draft({ shelves: ['team-1', 'team-1'] }).data?.shelves).toEqual(['team-1'])
  })

  it('collapses all-departments plus a department, which contradict each other', () => {
    expect(draft({ shelves: ['team-1', COMPANY_SHELF] }).data?.shelves).toEqual([COMPANY_SHELF])
  })

  it('leaves the summary and category optional but bounded', () => {
    expect(draft({ description: '', category: '' }).success).toBe(true)
    expect(draft({ description: 'x'.repeat(501) }).error?.issues[0]?.message).toBe(
      'Keep the summary under 500 characters.',
    )
  })
})

describe('bluebookQuerySchema', () => {
  const parse = (raw: Record<string, unknown>) => bluebookQuerySchema.parse(raw)

  it('opens on every shelf, newest first', () => {
    expect(parse({})).toMatchObject({
      page: 1,
      shelf: '',
      view: 'active',
      sortBy: 'createdAt',
      sortDirection: 'desc',
      categories: [],
    })
  })

  it('takes a shelf and a category list from the URL', () => {
    expect(parse({ shelf: 'team-1', categories: 'Policy,Training' })).toMatchObject({
      shelf: 'team-1',
      categories: ['Policy', 'Training'],
    })
  })

  it('falls back rather than throwing on a hand-edited URL', () => {
    expect(parse({ view: 'deleted', sortBy: 'downloads' })).toMatchObject({
      view: 'active',
      sortBy: 'createdAt',
    })
  })

  it('knows when a shelf or search is what emptied the list', () => {
    expect(isFilteredBluebookQuery(parse({}))).toBe(false)
    expect(isFilteredBluebookQuery(parse({ shelf: 'company' }))).toBe(true)
    expect(isFilteredBluebookQuery(parse({ search: 'onboarding' }))).toBe(true)
  })
})

import { PDFDocument } from 'pdf-lib'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  organization: { findUnique: vi.fn(async () => ({ name: 'Integrated Health Partners' })) },
}))
const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(async () => ({ user: { id: 'user-1' }, profile: {} })),
  membershipOf: vi.fn(() => ({ organizationId: 'org-1' })),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)

const { applyLetterheadToFile } = await import('./actions')

async function pdfFile(name = 'Policy.pdf') {
  const document = await PDFDocument.create()
  document.addPage()
  return new File([new Uint8Array(await document.save())], name, { type: 'application/pdf' })
}

function formOf(file: File | undefined, template = 'official') {
  const form = new FormData()
  form.set('template', template)
  if (file) form.set('file', file)
  return form
}

beforeEach(() => vi.clearAllMocks())

describe('applyLetterheadToFile', () => {
  it('returns a stamped copy named so it never overwrites the original', async () => {
    const original = await pdfFile()
    const result = await applyLetterheadToFile(formOf(original))

    if (!result.ok) throw new Error(result.message)
    expect(result.data.fileName).toBe('Policy (letterhead).pdf')
    expect(result.data.contentType).toBe('application/pdf')
    expect(result.data.bytes.byteLength).toBeGreaterThan(original.size)
    expect(guard.requireOnboarded).toHaveBeenCalled()
  })

  it('refuses a file type the letterhead cannot go on', async () => {
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    expect(await applyLetterheadToFile(formOf(text))).toEqual({
      ok: false,
      message: 'Choose a PDF or a Word (.docx) file.',
    })
  })

  it('refuses a missing file and an unknown template', async () => {
    expect(await applyLetterheadToFile(formOf(undefined))).toMatchObject({ ok: false })
    expect(await applyLetterheadToFile(formOf(await pdfFile(), 'none'))).toEqual({
      ok: false,
      message: 'Choose a letterhead.',
    })
  })

  it('explains a file it cannot read', async () => {
    const broken = new File(['not really a pdf'], 'broken.pdf', { type: 'application/pdf' })
    const result = await applyLetterheadToFile(formOf(broken, 'classic'))

    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining('Could not add the letterhead'),
    })
  })
})

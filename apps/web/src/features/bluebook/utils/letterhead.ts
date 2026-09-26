import { letterheadDocx } from './letterhead-docx'
import { letterheadPdf, LockedPdfError } from './letterhead-pdf'
import {
  LETTERHEAD_LAYOUTS,
  supportsLetterhead,
  type LetterheadTemplate,
} from './letterhead-templates'

/** A file the letterhead could not be put on; the message is written for the uploader. */
export class LetterheadError extends Error {}

export interface ApplyLetterheadInput {
  bytes: Uint8Array
  contentType: string
  template: LetterheadTemplate
  organizationName: string
}

/** The file with the chosen letterhead stamped in, or the same bytes when there is nothing to do. */
export async function applyLetterhead({
  bytes,
  contentType,
  template,
  organizationName,
}: ApplyLetterheadInput): Promise<Uint8Array> {
  if (template === 'none' || !supportsLetterhead(contentType)) return bytes
  const layout = LETTERHEAD_LAYOUTS[template]

  try {
    if (contentType === 'application/pdf') {
      return await letterheadPdf(bytes, layout, organizationName)
    }
    return letterheadDocx(bytes, layout, organizationName)
  } catch (error) {
    if (error instanceof LockedPdfError) {
      throw new LetterheadError(
        'That PDF is password-protected, so the letterhead cannot be added — remove the password or upload it with no letterhead.',
      )
    }
    throw new LetterheadError(
      'Could not add the letterhead to that file — re-save it and try again, or upload it with no letterhead.',
    )
  }
}

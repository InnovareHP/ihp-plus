import { z } from 'zod'
import { LETTERHEAD_TEMPLATES, supportsLetterhead } from './utils/letterhead-templates'

// nginx caps a request body at 25m (infra/docker/nginx/proxy.conf), so a larger file never arrives.
export const MAX_LETTERHEAD_BYTES = 25 * 1024 * 1024

export const LETTERHEAD_ACCEPT = '.pdf,.docx'

/** The templates this tool offers; "none" only makes sense as an upload option elsewhere. */
export const APPLICABLE_TEMPLATES = LETTERHEAD_TEMPLATES.filter((template) => template !== 'none')

/** The same check client- and server-side, so the message a user reads is the rule enforced. */
export function letterheadFileProblem(file: { size: number; type: string }) {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_LETTERHEAD_BYTES) return 'Files have to be 25 MB or smaller.'
  if (!supportsLetterhead(file.type)) return 'Choose a PDF or a Word (.docx) file.'
  return undefined
}

export const applyLetterheadSchema = z.object({
  template: z.enum(LETTERHEAD_TEMPLATES).exclude(['none']),
  file: z
    .instanceof(File, { message: 'Choose a file to put the letterhead on.' })
    .nullable()
    .superRefine((file, context) => {
      const problem = file ? letterheadFileProblem(file) : 'Choose a file to put the letterhead on.'
      if (problem) context.addIssue({ code: 'custom', message: problem })
    }),
})

export type ApplyLetterheadInput = z.input<typeof applyLetterheadSchema>
export type ApplyLetterheadValues = z.infer<typeof applyLetterheadSchema>

/** "Policy.pdf" becomes "Policy (letterhead).pdf", so the original is never overwritten. */
export function stampedFileName(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)} (letterhead)${name.slice(dot)}` : `${name} (letterhead)`
}

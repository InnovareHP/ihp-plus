const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Whether a description came from the rich text editor rather than the old plain-text box. */
export function isDescriptionHtml(text: string) {
  return /^\s*<[a-z]/i.test(text)
}

/** Old plain-text descriptions become paragraphs, a blank line between each, so they still read the same. */
export function descriptionToHtml(text: string) {
  if (isDescriptionHtml(text)) return text
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** The words a reader sees, for length rules that must not count markup. */
export function descriptionText(text: string) {
  if (!isDescriptionHtml(text)) return text.trim()
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
}

import sanitizeHtml from 'sanitize-html'
import { descriptionToHtml } from './description-html'

// The careers page is public, so only the markup the editor's toolbar can produce survives.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'code',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
  },
}

/** Safe HTML for a description, whichever editor wrote it. */
export function sanitizeDescription(text: string) {
  return sanitizeHtml(descriptionToHtml(text), OPTIONS)
}

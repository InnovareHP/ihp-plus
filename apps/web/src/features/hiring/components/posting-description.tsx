import { Typography } from '@mantine/core'

// The HTML arrives already sanitized by the public service, which is what makes rendering it safe.
export function PostingDescription({ html }: { html: string }) {
  return (
    <Typography
      maw="70ch"
      style={{ overflowWrap: 'anywhere' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

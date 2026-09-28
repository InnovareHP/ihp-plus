import { Stack, Text } from '@mantine/core'

// HR writes the description as plain text, so a blank line is where they meant a new paragraph.
export function PostingDescription({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <Stack gap="sm" maw="70ch">
      {paragraphs.map((paragraph, index) => (
        // Lines inside a paragraph stay as written, which is how a bullet-ish list survives.
        <Text key={index} style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          {paragraph}
        </Text>
      ))}
    </Stack>
  )
}

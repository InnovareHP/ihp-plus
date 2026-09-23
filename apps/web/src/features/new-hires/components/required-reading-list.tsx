import { Badge, Group, List, Text } from '@mantine/core'
import type { ChecklistDocument } from '../schema'

export function RequiredReadingList({ documents }: { documents: readonly ChecklistDocument[] }) {
  return (
    <List listStyleType="none" spacing={6}>
      {documents.map((document) => (
        <List.Item key={document.id}>
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color={document.acknowledged ? 'green' : 'gray'} miw={76}>
              {document.acknowledged ? 'Read' : 'Unread'}
            </Badge>
            <Text size="sm">{document.title}</Text>
          </Group>
        </List.Item>
      ))}
    </List>
  )
}

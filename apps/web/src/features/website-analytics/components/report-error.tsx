import { Alert, Button, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

export interface ReportErrorProps {
  message: string
  retrying: boolean
  onRetry: () => void
}

export function ReportError({ message, retrying, onRetry }: ReportErrorProps) {
  return (
    <Alert
      color="red"
      variant="light"
      title="Could not load the report"
      icon={<IconAlertTriangle size={18} aria-hidden />}
      role="alert"
    >
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{message}</Text>
        <Button variant="default" onClick={onRetry} loading={retrying}>
          Try again
        </Button>
      </Stack>
    </Alert>
  )
}

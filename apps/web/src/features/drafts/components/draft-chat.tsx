'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Loader, Paper, ScrollArea, Stack, Text, Textarea } from '@mantine/core'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { sendMessageSchema, type ChatMessage as Message, type SendMessageValues } from '../schema'
import { useSendDraftMessage } from '../use-drafts'
import { ChatMessage } from './chat-message'

export interface DraftChatProps {
  draftId: string
  messages: readonly Message[]
}

export function DraftChat({ draftId, messages }: DraftChatProps) {
  const send = useSendDraftMessage(draftId)
  const viewport = useRef<HTMLDivElement>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SendMessageValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { text: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  })

  // Scroll position is DOM state: keep the newest message in view as the log grows.
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
  }, [messages.length, send.isPending])

  const onSubmit = handleSubmit(({ text }) => {
    reset({ text: '' })
    send.mutate(text, {
      // A failed turn hands the message back, so nothing typed is lost.
      onError: (error) => {
        reset({ text })
        setError('text', { message: error.message })
      },
    })
  })

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (!send.isPending) void onSubmit()
    }
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <ScrollArea.Autosize mah={{ base: 360, lg: 520 }} viewportRef={viewport}>
          <Stack
            component="ol"
            gap="sm"
            m={0}
            p={0}
            style={{ listStyle: 'none' }}
            aria-label="Conversation"
            aria-live="polite"
            aria-busy={send.isPending}
          >
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}
            {send.isPending ? (
              <Group component="li" gap="xs">
                <Loader size="xs" aria-hidden />
                <Text size="sm" c="dimmed">
                  Drafting the changes…
                </Text>
              </Group>
            ) : null}
          </Stack>
        </ScrollArea.Autosize>

        <form onSubmit={onSubmit} noValidate>
          <Stack gap="xs">
            <Textarea
              label="Message"
              description="Enter sends, Shift+Enter starts a new line."
              placeholder="e.g. The client is Acme Corp, fee is $5,000 a month"
              autosize
              minRows={2}
              maxRows={8}
              error={errors.text?.message}
              errorProps={{ role: 'alert' }}
              onKeyDown={onKeyDown}
              {...register('text')}
            />
            <Group justify="flex-end">
              <Button type="submit" loading={send.isPending}>
                Send
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  )
}

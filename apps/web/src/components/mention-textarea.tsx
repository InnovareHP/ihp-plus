'use client'

import { Combobox, ScrollArea, Text, Textarea, useCombobox } from '@mantine/core'
import { useRef, useState, type KeyboardEvent } from 'react'
import { MENTION_EVERYONE, MENTION_EVERYONE_LABEL, type MentionPerson } from '@/lib/mentions'
import {
  insertMention,
  matchesMention,
  mentionQueryAt,
  type MentionQuery,
} from '@/lib/mention-query'

export interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** Called with the id behind the name that was picked, so the post carries who it meant. */
  onMention: (userId: string) => void
  colleagues: readonly MentionPerson[]
  /** Off where one reply must not be able to email the whole company. */
  allowEveryone?: boolean
  label: string
  description?: string
  placeholder?: string
  error?: string
  minRows?: number
  maxRows?: number
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

const MAX_SUGGESTIONS = 6

/** A comment box that offers names as "@" is typed, rather than making people spell them. */
export function MentionTextarea({
  value,
  onChange,
  onBlur,
  onMention,
  colleagues,
  label,
  description,
  placeholder,
  error,
  minRows = 3,
  maxRows = 10,
  onKeyDown,
  allowEveryone = true,
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [query, setQuery] = useState<MentionQuery | undefined>(undefined)
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })

  const people = [
    ...(allowEveryone
      ? [{ userId: MENTION_EVERYONE, name: MENTION_EVERYONE_LABEL, mentionAs: 'everyone' }]
      : []),
    ...colleagues.map((one) => ({ userId: one.userId, name: one.name, mentionAs: one.name })),
  ]

  const matches = query
    ? people.filter((one) => matchesMention(one.name, query.text)).slice(0, MAX_SUGGESTIONS)
    : []

  function look(next: string, caret: number) {
    const found = mentionQueryAt(next, caret)
    setQuery(found)

    if (found) {
      combobox.openDropdown()
      combobox.selectFirstOption()
    } else {
      combobox.closeDropdown()
    }
  }

  function pick(userId: string) {
    const person = people.find((one) => one.userId === userId)
    if (!person || !query) return

    const inserted = insertMention(value, query, person.mentionAs)
    onChange(inserted.value)
    onMention(person.userId)
    setQuery(undefined)
    combobox.closeDropdown()

    // The caret belongs after the name, which React would otherwise park at the end.
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(inserted.caret, inserted.caret)
    })
  }

  function keys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (query && matches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        combobox.selectNextOption()
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        combobox.selectPreviousOption()
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        combobox.clickSelectedOption()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setQuery(undefined)
        combobox.closeDropdown()
        return
      }
    }

    onKeyDown?.(event)
  }

  return (
    <Combobox store={combobox} onOptionSubmit={pick} withinPortal={false}>
      <Combobox.Target>
        <Textarea
          ref={ref}
          value={value}
          label={label}
          description={description}
          placeholder={placeholder}
          autosize
          minRows={minRows}
          maxRows={maxRows}
          error={error}
          errorProps={{ role: 'alert' }}
          onChange={(event) => {
            onChange(event.currentTarget.value)
            look(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
          }}
          onClick={(event) => look(value, event.currentTarget.selectionStart ?? 0)}
          onBlur={() => {
            combobox.closeDropdown()
            onBlur?.()
          }}
          onKeyDown={keys}
        />
      </Combobox.Target>

      <Combobox.Dropdown hidden={matches.length === 0}>
        <Combobox.Options>
          <ScrollArea.Autosize mah={220} type="scroll">
            {matches.map((person) => (
              <Combobox.Option value={person.userId} key={person.userId}>
                <Text size="sm">{person.name}</Text>
              </Combobox.Option>
            ))}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}

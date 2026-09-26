'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Anchor,
  Button,
  FileInput,
  Group,
  MultiSelect,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { formatBytes } from '@/lib/file-look'
import {
  ACCEPTED_EXTENSIONS,
  COMPANY_SHELF,
  documentDraftSchema,
  EMPTY_DOCUMENT_DRAFT,
  fileProblem,
  type DocumentDraftInput,
  type DocumentDraftValues,
} from '../schema'
import { LETTERHEAD_OPTIONS, supportsLetterhead } from '../utils/letterhead-templates'
import type { UploadDocumentModalProps } from './upload-document-modal'

/** Whichever of "all departments" or a department list was chosen most recently. */
function collapseShelves(previous: readonly string[], next: readonly string[]) {
  const added = next.filter((value) => !previous.includes(value))

  if (added.includes(COMPANY_SHELF)) return [COMPANY_SHELF]
  if (added.length > 0) return next.filter((value) => value !== COMPANY_SHELF)
  return [...next]
}

export function DocumentForm({
  shelves,
  categories,
  canManageCategories,
  onManageCategories,
  defaults,
  onUpload,
  onSave,
  submitLabel,
  onClose,
}: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DocumentDraftInput, unknown, DocumentDraftValues>({
    resolver: zodResolver(documentDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults ?? {
      ...EMPTY_DOCUMENT_DRAFT,
      shelves: [shelves[0]?.value ?? COMPANY_SHELF],
    },
  })

  // useWatch rather than watch(): the latter returns a function the React compiler cannot
  // memoize, and both values feed controls that re-render on every keystroke.
  const watchedShelves = useWatch({ control, name: 'shelves' })
  const category = useWatch({ control, name: 'category' }) ?? ''
  const letterhead = useWatch({ control, name: 'letterhead' }) ?? 'none'
  const stampable = !file || supportsLetterhead(file.type)
  const picked = (watchedShelves ?? []).filter((value): value is string => Boolean(value))

  const problem = file
    ? fileProblem({ name: file.name, size: file.size, type: file.type })
    : undefined

  async function onSubmit(values: DocumentDraftValues) {
    try {
      if (onUpload) {
        if (!file) {
          setError('root', { message: 'Choose a file to upload.' })
          return
        }
        if (problem) {
          setError('root', { message: problem })
          return
        }
        await onUpload(values, file)
      } else {
        await onSave?.(values)
      }
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save this document.',
      })
      return
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not file this document">
            {errors.root.message}
          </Alert>
        ) : null}

        {onUpload ? (
          <FileInput
            label="File"
            description={`PDF, Office document, text or image — up to ${formatBytes(25 * 1024 * 1024)}.`}
            placeholder="Choose a file"
            accept={ACCEPTED_EXTENSIONS}
            leftSection={<IconPaperclip size={16} aria-hidden />}
            value={file}
            onChange={setFile}
            required
            aria-required="true"
            error={problem}
            clearable
          />
        ) : null}

        {onUpload ? (
          <Select
            label="Letterhead"
            description={
              stampable
                ? 'Added to the top of every page of a PDF or Word (.docx) file.'
                : 'This file type is filed as it is — letterheads go on PDF and Word (.docx) files.'
            }
            data={LETTERHEAD_OPTIONS}
            value={stampable ? letterhead : 'none'}
            allowDeselect={false}
            disabled={!stampable}
            onChange={(value) =>
              setValue(
                'letterhead',
                LETTERHEAD_OPTIONS.find((option) => option.value === value)?.value ?? 'none',
                { shouldDirty: true },
              )
            }
          />
        ) : null}

        <TextInput
          {...register('title')}
          label="Title"
          placeholder="Time-off request policy"
          required
          aria-required="true"
          error={errors.title?.message}
          data-autofocus
        />

        <Group grow align="flex-start">
          <MultiSelect
            label="Filed under"
            placeholder="Pick one or more shelves"
            description="Every department that should find it."
            data={shelves.map((shelf) => ({ value: shelf.value, label: shelf.label }))}
            value={picked}
            searchable
            required
            aria-required="true"
            onChange={(values) =>
              // "All departments" and a specific one contradict each other, so the last pick
              // wins rather than leaving both showing.
              setValue('shelves', collapseShelves(picked, values), { shouldDirty: true })
            }
            error={errors.shelves?.message}
          />
          <Select
            label="Category"
            placeholder="Choose a category"
            description={
              canManageCategories ? (
                <Anchor component="button" type="button" size="xs" onClick={onManageCategories}>
                  Manage categories
                </Anchor>
              ) : undefined
            }
            data={categories}
            value={category}
            clearable
            searchable
            nothingFoundMessage="No category yet"
            onChange={(value) => setValue('category', value ?? '', { shouldDirty: true })}
            error={errors.category?.message}
          />
        </Group>

        <Textarea
          {...register('description')}
          label="Summary"
          placeholder="What this document covers and who needs it"
          description="One or two lines on what this covers and who needs it."
          autosize
          minRows={2}
          maxRows={6}
          error={errors.description?.message}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

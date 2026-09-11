'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Anchor,
  Button,
  FileInput,
  Group,
  Modal,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  ACCEPTED_EXTENSIONS,
  documentDraftSchema,
  EMPTY_DOCUMENT_DRAFT,
  fileProblem,
  formatBytes,
  type DocumentDraftValues,
  type ShelfOption,
} from '../schema'

export interface UploadDocumentModalProps {
  opened: boolean
  onClose: () => void
  /** Only the shelves this person may file on; the picker never offers a refusal. */
  shelves: ShelfOption[]
  categories: string[]
  canManageCategories: boolean
  onManageCategories: () => void
  defaults?: DocumentDraftValues
  /** Absent for an edit: metadata changes never replace the stored file. */
  onUpload?: (values: DocumentDraftValues, file: File) => Promise<void>
  onSave?: (values: DocumentDraftValues) => Promise<void>
  title: string
  submitLabel: string
}

export function UploadDocumentModal(props: UploadDocumentModalProps) {
  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={props.title}
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': `Close ${props.title.toLowerCase()}` }}
    >
      {/* Keyed on the record so opening a different document resets the fields without an effect. */}
      <DocumentForm key={props.defaults?.title ?? 'new'} {...props} />
    </Modal>
  )
}

function DocumentForm({
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
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DocumentDraftValues>({
    resolver: zodResolver(documentDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults ?? { ...EMPTY_DOCUMENT_DRAFT, shelf: shelves[0]?.value ?? '' },
  })

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
          <Select
            label="Filed under"
            description="Where people will look for it."
            data={shelves.map((shelf) => ({ value: shelf.value, label: shelf.label }))}
            value={watch('shelf')}
            allowDeselect={false}
            searchable
            onChange={(value) => value && setValue('shelf', value, { shouldDirty: true })}
            error={errors.shelf?.message}
          />
          <Select
            label="Category"
            description={
              canManageCategories ? (
                <Anchor component="button" type="button" size="xs" onClick={onManageCategories}>
                  Manage categories
                </Anchor>
              ) : undefined
            }
            data={categories}
            value={watch('category')}
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

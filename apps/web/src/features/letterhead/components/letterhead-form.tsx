'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Card, FileInput, Group, Radio, Stack, Text } from '@mantine/core'
import { IconCircleCheck, IconPaperclip } from '@tabler/icons-react'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
import {
  applyLetterheadSchema,
  LETTERHEAD_ACCEPT,
  letterheadFileProblem,
  type ApplyLetterheadInput,
  type ApplyLetterheadValues,
} from '../schema'
import { useApplyLetterhead } from '../use-apply-letterhead'
import { downloadFile } from '../utils/download'
import { LETTERHEAD_OPTIONS } from '../utils/letterhead-templates'

const TEMPLATE_OPTIONS = LETTERHEAD_OPTIONS.filter((option) => option.value !== 'none')

/** Pick a file and a letterhead; the stamped copy downloads, and the original is left alone. */
export function LetterheadForm() {
  const apply = useApplyLetterhead()
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ApplyLetterheadInput, unknown, ApplyLetterheadValues>({
    resolver: zodResolver(applyLetterheadSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { template: 'official', file: null },
  })

  async function submit(values: ApplyLetterheadValues) {
    try {
      const stamped = await apply.mutateAsync(values)
      downloadFile(stamped)
      announceSuccess(`Letterhead added — ${stamped.fileName} is downloading.`)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not add the letterhead.',
      })
    }
  }

  const stamped = apply.data

  return (
    <Card withBorder padding="lg" maw={640}>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not add the letterhead" />

          <Controller
            control={control}
            name="file"
            render={({ field }) => (
              <FileInput
                label="File"
                description="A PDF or a Word (.docx) file, up to 25 MB. You get a copy back; the original is not changed."
                placeholder="Choose a file"
                accept={LETTERHEAD_ACCEPT}
                leftSection={<IconPaperclip size={16} aria-hidden />}
                value={field.value}
                onChange={(file) => field.onChange(file)}
                onBlur={field.onBlur}
                // FileInput renders a button, which may not carry aria-required.
                required
                clearable
                error={
                  errors.file?.message ??
                  (field.value ? letterheadFileProblem(field.value) : undefined)
                }
                errorProps={{ role: 'alert' }}
              />
            )}
          />

          <Controller
            control={control}
            name="template"
            render={({ field }) => (
              <Radio.Group
                label="Letterhead"
                description="Pages are shrunk just enough to fit under the header and above the footer."
                value={field.value}
                onChange={field.onChange}
                required
              >
                <Stack gap="xs" mt="xs">
                  {TEMPLATE_OPTIONS.map((option) => (
                    <Radio key={option.value} value={option.value} label={option.label} />
                  ))}
                </Stack>
              </Radio.Group>
            )}
          />

          {stamped && !apply.isPending ? (
            <Alert
              color="teal"
              variant="light"
              icon={<IconCircleCheck size={18} aria-hidden />}
              title="Letterhead added"
            >
              <Text size="sm">
                {stamped.fileName} downloaded.{' '}
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  onClick={() => downloadFile(stamped)}
                >
                  Download it again
                </Anchor>
              </Text>
            </Alert>
          ) : null}

          <Group justify="flex-end">
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Adding letterhead…' : 'Add letterhead and download'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  )
}

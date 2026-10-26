'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FileInput, Modal, Stack, Text } from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import { Controller, useForm } from 'react-hook-form'
import { DialogActions } from '@/components/dialog-actions'
import { FormError } from '@/components/form-error'
import {
  newContractSchema,
  PROPOSAL_ACCEPT,
  proposalFileProblem,
  type NewContractValues,
} from '../schema'
import { useCreateDraft } from '../use-drafts'

export interface NewContractModalProps {
  opened: boolean
  onClose: () => void
}

export function NewContractModal({ opened, onClose }: NewContractModalProps) {
  const create = useCreateDraft()
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewContractValues>({
    resolver: zodResolver(newContractSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { proposal: null },
  })

  async function submit(values: NewContractValues) {
    try {
      await create.mutateAsync(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not start the contract.',
      })
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New contract" centered>
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not start the contract" />
          <Text size="sm">
            Attach the client’s proposal and the assistant drafts the contract from it — scope, fees
            and deliverables included. Without one you start from the blank agreement.
          </Text>
          <Controller
            control={control}
            name="proposal"
            render={({ field }) => (
              <FileInput
                label="Proposal (optional)"
                description="A PDF or Word (.docx) file, up to 4.5 MB."
                placeholder="Choose a file"
                accept={PROPOSAL_ACCEPT}
                leftSection={<IconPaperclip size={16} aria-hidden />}
                value={field.value}
                onChange={(file) => field.onChange(file)}
                onBlur={field.onBlur}
                clearable
                error={
                  errors.proposal?.message ??
                  (field.value ? proposalFileProblem(field.value) : undefined)
                }
                errorProps={{ role: 'alert' }}
              />
            )}
          />
          <DialogActions>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Starting…' : 'Start contract'}
            </Button>
          </DialogActions>
        </Stack>
      </form>
    </Modal>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, TextInput } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { monthKeySchema } from '../schema'

const exportSchema = z.object({ month: monthKeySchema })
type ExportValues = z.infer<typeof exportSchema>

export interface ExportMonthFormProps {
  thisMonth: string
  onExport: (month: string) => Promise<void>
}

/** A month of checks as a file, unchecked rounds included, for whoever audits the IT lead. */
export function ExportMonthForm({ thisMonth, onExport }: ExportMonthFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExportValues>({
    resolver: zodResolver(exportSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { month: thisMonth },
  })

  async function onSubmit(values: ExportValues) {
    try {
      await onExport(values.month)
    } catch (error) {
      setError('month', {
        message: error instanceof Error ? error.message : 'Could not build the file.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Download a month of checks">
      <Group align="flex-end" gap="xs" wrap="wrap">
        <TextInput
          {...register('month')}
          type="month"
          label="Month"
          max={thisMonth}
          w={180}
          error={errors.month?.message}
        />
        <Button
          type="submit"
          variant="default"
          loading={isSubmitting}
          leftSection={<IconDownload size={18} aria-hidden />}
        >
          {isSubmitting ? 'Building file…' : 'Download CSV'}
        </Button>
      </Group>
    </form>
  )
}

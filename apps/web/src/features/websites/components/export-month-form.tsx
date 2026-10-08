'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Select, Stack, TextInput } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { Controller, useForm } from 'react-hook-form'
import { exportMonthSchema, type ExportMonthValues, type WebsiteOption } from '../schema'

export interface ExportMonthFormProps {
  thisMonth: string
  websites: readonly WebsiteOption[]
  websitesLoading: boolean
  onExport: (values: ExportMonthValues) => Promise<void>
}

/** A month of checks as a file, for every site or one, unchecked rounds included. */
export function ExportMonthForm({
  thisMonth,
  websites,
  websitesLoading,
  onExport,
}: ExportMonthFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExportMonthValues>({
    resolver: zodResolver(exportMonthSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { month: thisMonth, websiteId: '' },
  })

  async function onSubmit(values: ExportMonthValues) {
    try {
      await onExport(values)
    } catch (error) {
      setError('month', {
        message: error instanceof Error ? error.message : 'Could not build the file.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Download a month of checks">
      <Stack gap="sm">
        <Group align="flex-start" gap="sm" wrap="wrap">
          <TextInput
            {...register('month')}
            type="month"
            label="Month"
            max={thisMonth}
            w={180}
            error={errors.month?.message}
          />
          <Controller
            control={control}
            name="websiteId"
            render={({ field }) => (
              <Select
                label="Website"
                placeholder={websitesLoading ? 'Loading…' : 'All websites'}
                data={websites.map((site) => ({
                  value: site.id,
                  label: site.removed ? `${site.name} (removed)` : site.name,
                }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                clearable
                searchable
                nothingFoundMessage="No website by that name"
                w={{ base: '100%', xs: 280 }}
              />
            )}
          />
        </Group>
        <Group justify="flex-end">
          <Button
            type="submit"
            variant="default"
            loading={isSubmitting}
            leftSection={<IconDownload size={18} aria-hidden />}
          >
            {isSubmitting ? 'Building file…' : 'Download CSV'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

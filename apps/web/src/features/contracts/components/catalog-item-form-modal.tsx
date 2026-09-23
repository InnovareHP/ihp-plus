'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Anchor,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import {
  CATALOG_UNITS,
  CATALOG_UNIT_LABELS,
  catalogItemSchema,
  type CatalogItemInput,
  type CatalogItemValues,
} from '../schema'
import { useCreateCatalogItem } from '../use-contracts'

const UNIT_OPTIONS = CATALOG_UNITS.map((value) => ({
  value,
  label: `Per ${CATALOG_UNIT_LABELS[value]}`,
}))

const EMPTY_ITEM: CatalogItemInput = {
  category: '',
  name: '',
  description: '',
  priceMinCents: 0,
  priceMaxCents: 0,
  unit: 'project',
  percentOfSpend: undefined,
  defaultTerms: '',
}

export interface CatalogItemFormModalProps {
  opened: boolean
  onClose: () => void
  /** The catalogSection lookup list, in the admin's order. */
  sections: string[]
  onManageSections: () => void
}

export function CatalogItemFormModal({
  opened,
  onClose,
  sections,
  onManageSections,
}: CatalogItemFormModalProps) {
  const create = useCreateCatalogItem()
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CatalogItemInput, unknown, CatalogItemValues>({
    resolver: zodResolver(catalogItemSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: EMPTY_ITEM,
  })

  async function onSubmit(values: CatalogItemValues) {
    try {
      await create.mutateAsync(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not add the service.',
      })
      return
    }
    reset(EMPTY_ITEM)
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add a service"
      size="lg"
      centered
      closeButtonProps={{ 'aria-label': 'Close add a service' }}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not add the service" />

          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                label="Section"
                placeholder="Choose a section"
                description={
                  <Anchor component="button" type="button" size="xs" onClick={onManageSections}>
                    Manage sections
                  </Anchor>
                }
                data={sections}
                allowDeselect={false}
                searchable
                nothingFoundMessage="No match — add it under Manage sections"
                required
                value={field.value || null}
                onChange={(value) => value && field.onChange(value)}
                onBlur={field.onBlur}
                error={errors.category?.message}
              />
            )}
          />

          <TextInput
            {...register('name')}
            label="Service name"
            required
            autoComplete="off"
            error={errors.name?.message}
          />

          <Textarea
            {...register('description')}
            label="Description"
            description="How the rate card sells it; shown when picking services for a contract."
            autosize
            minRows={2}
            maxRows={6}
            error={errors.description?.message}
          />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Controller
              control={control}
              name="priceMinCents"
              render={({ field }) => (
                <NumberInput
                  label="Price from"
                  required
                  prefix="$"
                  thousandSeparator=","
                  min={0}
                  // Dollars on screen, cents on the wire and in the database.
                  value={field.value / 100}
                  onChange={(value) => field.onChange(Math.round(Number(value || 0) * 100))}
                  onBlur={field.onBlur}
                  error={errors.priceMinCents?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="priceMaxCents"
              render={({ field }) => (
                <NumberInput
                  label="Price to"
                  required
                  prefix="$"
                  thousandSeparator=","
                  min={0}
                  value={field.value / 100}
                  onChange={(value) => field.onChange(Math.round(Number(value || 0) * 100))}
                  onBlur={field.onBlur}
                  error={errors.priceMaxCents?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select
                  label="Billed"
                  data={UNIT_OPTIONS}
                  allowDeselect={false}
                  required
                  value={field.value}
                  onChange={(value) => value && field.onChange(value)}
                  onBlur={field.onBlur}
                  error={errors.unit?.message}
                />
              )}
            />
          </SimpleGrid>

          <Controller
            control={control}
            name="percentOfSpend"
            render={({ field }) => (
              <NumberInput
                label="Or percent of ad spend"
                description="Leave empty unless the service can be charged as a share of spend."
                suffix="%"
                min={0}
                max={100}
                allowDecimal={false}
                value={field.value ?? ''}
                onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                onBlur={field.onBlur}
                error={errors.percentOfSpend?.message}
              />
            )}
          />

          <Textarea
            {...register('defaultTerms')}
            label="Contract terms"
            description="What a contract including this service commits to; added to its terms."
            autosize
            minRows={3}
            maxRows={10}
            error={errors.defaultTerms?.message}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add service'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { DEFAULT_CLIENT_QUERY } from '@/features/clients/schema'
import { useClients } from '@/features/clients/hooks/use-clients'
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  CATALOG_CATEGORY_LABELS,
  composeTerms,
  contractDraftSchema,
  formatCents,
  formatPriceRange,
  lineTotalCents,
  subtotalOf,
  type CatalogItemRow,
  type ContractDetail,
  type ContractDraftInput,
  type ContractDraftValues,
} from '../schema'
import {
  useCatalog,
  useContractTemplate,
  useCreateContract,
  useUpdateContract,
} from '../use-contracts'

const EMPTY_DRAFT: ContractDraftInput = {
  clientId: '',
  title: '',
  billingCycle: 'monthly',
  startDate: '',
  endDate: '',
  terms: '',
  lines: [],
}

export interface ContractFormModalProps {
  opened: boolean
  onClose: () => void
  /** Pre-selects the client when the contract is started from one. */
  clientId?: string
  /** Present when editing; the service refuses anything that is not still a draft. */
  contract?: ContractDetail
}

function draftOf(contract: ContractDetail): ContractDraftInput {
  return {
    clientId: contract.clientId,
    title: contract.title,
    billingCycle: contract.billingCycle,
    // The wire carries a full ISO timestamp; a date input wants the day.
    startDate: contract.startDate?.slice(0, 10) ?? '',
    endDate: contract.endDate?.slice(0, 10) ?? '',
    terms: contract.terms ?? '',
    lines: contract.lines.map((line) => ({
      catalogItemId: line.catalogItemId,
      name: line.name,
      description: line.description ?? '',
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      unit: line.unit,
    })),
  }
}

export function ContractFormModal({ opened, onClose, clientId, contract }: ContractFormModalProps) {
  const catalog = useCatalog()
  const template = useContractTemplate()
  // One page of clients sorted by name, which the searchable Select filters. A book longer
  // than a page needs a search-backed picker rather than a bigger page.
  const clients = useClients({
    ...DEFAULT_CLIENT_QUERY,
    pageSize: 100,
    sortBy: 'name',
    sortDirection: 'asc',
  })
  const create = useCreateContract()
  const update = useUpdateContract()
  const isEditing = contract !== undefined

  // Three generics because the schema has defaults: the form holds the input shape and the
  // resolver hands onSubmit the parsed output.
  const form = useForm<ContractDraftInput, unknown, ContractDraftValues>({
    resolver: zodResolver(contractDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: contract ? draftOf(contract) : { ...EMPTY_DRAFT, clientId: clientId ?? '' },
  })
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    getFieldState,
    formState: { errors, isSubmitting },
  } = form
  const lines = useFieldArray({ control, name: 'lines' })

  // Watched rather than read on submit: the total has to move as prices are typed.
  const watchedLines = watch('lines')
  const subtotal = subtotalOf(watchedLines ?? [])

  const suggestedTerms = composeTerms({
    lines: watchedLines ?? [],
    catalog: catalog.data ?? [],
    template: template.data,
  })

  // Composition is a side effect of the picked services changing, which is external to this
  // render. It stops as soon as the terms are edited: what somebody typed is never overwritten.
  // An existing contract already has agreed wording; composing over it would discard it.
  const termsEdited = useRef(isEditing)
  useEffect(() => {
    if (termsEdited.current || getFieldState('terms').isDirty) return
    setValue('terms', suggestedTerms)
  }, [suggestedTerms, getFieldState, setValue])

  /** Adding from the card seeds the agreed price with the bottom of its range. */
  function addFromCatalog(item: CatalogItemRow) {
    lines.append({
      catalogItemId: item.id,
      name: item.name,
      description: item.description ?? '',
      unitPriceCents: item.priceMinCents,
      quantity: 1,
      unit: item.unit,
    })
  }

  async function onSubmit(values: ContractDraftValues) {
    try {
      if (contract) {
        await update.mutateAsync({ ...values, contractId: contract.id })
      } else {
        await create.mutateAsync(values)
      }
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the contract.',
      })
      return
    }

    if (!contract) reset({ ...EMPTY_DRAFT, clientId: clientId ?? '' })
    onClose()
  }

  const catalogOptions = (catalog.data ?? []).map((item) => ({
    value: item.id,
    label: `${CATALOG_CATEGORY_LABELS[item.category]} · ${item.name} — ${formatPriceRange(item)}`,
  }))

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit ${contract.reference}` : 'New contract'}
      size="xl"
      centered
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not save the contract" />

          <Group grow align="flex-start">
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <Select
                  label="Client"
                  description="Who the contract is with."
                  placeholder={clients.isPending ? 'Loading…' : 'Pick a client'}
                  searchable
                  required
                  aria-required="true"
                  disabled={clients.isPending}
                  data={(clients.data?.rows ?? []).map((client) => ({
                    value: client.id,
                    label: client.name,
                  }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? '')}
                  onBlur={field.onBlur}
                  error={errors.clientId?.message}
                />
              )}
            />

            <TextInput
              {...register('title')}
              label="Title"
              description="What this agreement covers."
              placeholder="Growth retainer"
              required
              aria-required="true"
              error={errors.title?.message}
            />
          </Group>

          <Group grow align="flex-start">
            <Controller
              control={control}
              name="billingCycle"
              render={({ field }) => (
                <Select
                  label="Billing"
                  description="Whether it recurs or is billed once."
                  data={BILLING_CYCLES.map((cycle) => ({
                    value: cycle,
                    label: BILLING_CYCLE_LABELS[cycle],
                  }))}
                  allowDeselect={false}
                  value={field.value}
                  onChange={(value) => value && field.onChange(value)}
                  onBlur={field.onBlur}
                />
              )}
            />
            <TextInput
              {...register('startDate')}
              label="Start date"
              description="Optional."
              type="date"
            />
            <TextInput
              {...register('endDate')}
              label="End date"
              description="Optional; leave blank for open-ended."
              type="date"
            />
          </Group>

          <Divider label="Services" labelPosition="left" />

          <Select
            label="Add from the rate card"
            description="Picking one fills its name and unit; the agreed price is yours to set."
            placeholder={catalog.isPending ? 'Loading the rate card…' : 'Choose a service'}
            searchable
            disabled={catalog.isPending}
            data={catalogOptions}
            value={null}
            onChange={(value) => {
              const item = catalog.data?.find((row) => row.id === value)
              if (item) addFromCatalog(item)
            }}
          />

          {errors.lines?.message ? (
            <Text size="sm" c="red.7" role="alert">
              {errors.lines.message}
            </Text>
          ) : null}

          {lines.fields.length > 0 ? (
            <Table.ScrollContainer minWidth={640}>
              <Table withTableBorder withColumnBorders verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col">Service</Table.Th>
                    <Table.Th scope="col" w={150}>
                      Agreed price
                    </Table.Th>
                    <Table.Th scope="col" w={110}>
                      Quantity
                    </Table.Th>
                    <Table.Th scope="col" w={120}>
                      Line total
                    </Table.Th>
                    <Table.Th scope="col" w={60}>
                      <span aria-hidden>Remove</span>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lines.fields.map((field, index) => (
                    <Table.Tr key={field.id}>
                      <Table.Th scope="row" fw={400}>
                        <TextInput
                          {...register(`lines.${index}.name`)}
                          aria-label={`Service ${index + 1}`}
                          error={errors.lines?.[index]?.name?.message}
                        />
                      </Table.Th>
                      <Table.Td>
                        <Controller
                          control={control}
                          name={`lines.${index}.unitPriceCents`}
                          render={({ field: price }) => (
                            <NumberInput
                              aria-label={`Price for ${watchedLines?.[index]?.name ?? `service ${index + 1}`}`}
                              prefix="$"
                              thousandSeparator=","
                              min={0}
                              // Dollars on screen, cents on the wire and in the database.
                              value={price.value / 100}
                              onChange={(value) =>
                                price.onChange(Math.round(Number(value || 0) * 100))
                              }
                              onBlur={price.onBlur}
                            />
                          )}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Controller
                          control={control}
                          name={`lines.${index}.quantity`}
                          render={({ field: quantity }) => (
                            <NumberInput
                              aria-label={`Quantity for ${watchedLines?.[index]?.name ?? `service ${index + 1}`}`}
                              min={1}
                              max={999}
                              value={quantity.value}
                              onChange={(value) => quantity.onChange(Number(value || 1))}
                              onBlur={quantity.onBlur}
                            />
                          )}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {formatCents(lineTotalCents(watchedLines?.[index] ?? field))}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Remove ${watchedLines?.[index]?.name ?? `service ${index + 1}`}`}
                          onClick={() => lines.remove(index)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <Text size="sm" c="dimmed">
              Nothing priced yet. Add a service from the rate card above.
            </Text>
          )}

          <Group justify="flex-end">
            <Text size="sm" c="dimmed">
              Subtotal
            </Text>
            <Text fw={700} fz="lg">
              {formatCents(subtotal)}
            </Text>
          </Group>

          <Stack gap={4}>
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs">
              <Text size="sm" fw={500} component="label" htmlFor="contract-terms">
                Scope and terms
              </Text>
              <Button
                variant="subtle"
                size="compact-xs"
                type="button"
                onClick={() => {
                  termsEdited.current = false
                  setValue('terms', suggestedTerms, { shouldDirty: false })
                }}
              >
                Rebuild from services
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Filled from the services you picked and your standard terms. Edit freely — it stops
              rebuilding once you do.
            </Text>
            <Textarea
              {...register('terms', { onChange: () => (termsEdited.current = true) })}
              id="contract-terms"
              autosize
              minRows={6}
              maxRows={16}
              error={errors.terms?.message}
            />
          </Stack>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create contract'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

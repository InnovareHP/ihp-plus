'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Button,
  Divider,
  Fieldset,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { track } from '@/lib/analytics'
import { announceSuccess } from '@/lib/announce'
import { attendanceEvents } from '../events'
import { useSaveStatement } from '../hooks/use-statements'
import { billingStatementSchema, type BillingStatementValues } from '../schema'
import {
  billingStatementHtml,
  formatStatementDate,
  formatUsd,
  printHtml,
  statementTotals,
  type StatementPeriod,
} from '../utils/billing-statement'

export interface BillingStatementModalProps {
  opened: boolean
  onClose: () => void
  period: StatementPeriod
  /** How many of the seeded days were paid leave rather than clocked, said under the summary. */
  paidDaysOff?: number
  /** Filled from the timesheet, the session and the last statement; every field stays editable. */
  initial: BillingStatementValues
}

const MONEY = { prefix: '$', thousandSeparator: ',', decimalScale: 2, min: 0 } as const

function toCents(value: string | number) {
  return Math.round(Number(value || 0) * 100)
}

/** A contractor's statement for the range on screen: kept on file, then printed or saved as a PDF. */
export function BillingStatementModal({
  opened,
  onClose,
  period,
  paidDaysOff = 0,
  initial,
}: BillingStatementModalProps) {
  const save = useSaveStatement()
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BillingStatementValues>({
    resolver: zodResolver(billingStatementSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: initial,
  })
  const expenses = useFieldArray({ control, name: 'expenses' })

  // Watched so the total moves as amounts are typed.
  const watched = useWatch({ control })
  const totals = statementTotals({
    daysWorked: watched.daysWorked ?? 0,
    dailyRateCents: watched.dailyRateCents ?? 0,
    bonusCents: watched.bonusCents ?? 0,
    expenses: (watched.expenses ?? []).map((row) => ({
      description: row.description ?? '',
      amountCents: row.amountCents ?? 0,
    })),
  })

  async function submit(values: BillingStatementValues) {
    try {
      await save.mutateAsync({ ...values, periodStart: period.from, periodEnd: period.to })
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the statement.',
      })
      return
    }

    try {
      printHtml(billingStatementHtml(values, period))
    } catch (error) {
      track(attendanceEvents.statementPrintFailed, {
        reason: error instanceof Error ? error.message : 'unknown',
      })
      setError('root', {
        message:
          'The statement is saved, but the print view would not open — allow printing for this site and print it from your statements.',
      })
      return
    }

    track(attendanceEvents.statementPrinted, {
      days: values.daysWorked,
      expenses: values.expenses.length,
    })
    announceSuccess('Billing statement saved — print it or save it as a PDF.')
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Billing statement"
      closeButtonProps={{ 'aria-label': 'Close billing statement' }}
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not create the statement" />
          <Text size="sm" c="dimmed">
            Billing period {formatStatementDate(period.from)} – {formatStatementDate(period.to)}.
            Days and hours come from your timesheet; change the range above to bill a different
            period.
          </Text>

          <Fieldset legend="Contractor">
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Full name"
                  required
                  aria-required="true"
                  autoComplete="name"
                  error={errors.contractorName?.message}
                  errorProps={{ role: 'alert' }}
                  {...register('contractorName')}
                />
                <TextInput
                  label="Position / role"
                  required
                  aria-required="true"
                  autoComplete="organization-title"
                  error={errors.position?.message}
                  errorProps={{ role: 'alert' }}
                  {...register('position')}
                />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Invoice number"
                  required
                  aria-required="true"
                  error={errors.invoiceNumber?.message}
                  errorProps={{ role: 'alert' }}
                  {...register('invoiceNumber')}
                />
                <TextInput
                  type="date"
                  label="Invoice date"
                  required
                  aria-required="true"
                  error={errors.invoiceDate?.message}
                  errorProps={{ role: 'alert' }}
                  {...register('invoiceDate')}
                />
              </SimpleGrid>
            </Stack>
          </Fieldset>

          <Fieldset legend="Work summary">
            {paidDaysOff > 0 ? (
              <Text size="sm" c="dimmed" mb="sm">
                Days worked includes {paidDaysOff} paid {paidDaysOff === 1 ? 'day' : 'days'} off.
              </Text>
            ) : null}
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Controller
                control={control}
                name="daysWorked"
                render={({ field }) => (
                  <NumberInput
                    label="Days worked"
                    min={0}
                    max={366}
                    allowDecimal={false}
                    value={field.value}
                    onChange={(value) => field.onChange(Number(value || 0))}
                    onBlur={field.onBlur}
                    error={errors.daysWorked?.message}
                    errorProps={{ role: 'alert' }}
                  />
                )}
              />
              <Controller
                control={control}
                name="hoursWorked"
                render={({ field }) => (
                  <NumberInput
                    label="Hours worked"
                    min={0}
                    decimalScale={2}
                    value={field.value}
                    onChange={(value) => field.onChange(Number(value || 0))}
                    onBlur={field.onBlur}
                    error={errors.hoursWorked?.message}
                    errorProps={{ role: 'alert' }}
                  />
                )}
              />
              <Controller
                control={control}
                name="dailyRateCents"
                render={({ field }) => (
                  <NumberInput
                    {...MONEY}
                    label="Daily rate"
                    required
                    aria-required="true"
                    inputMode="decimal"
                    value={field.value ? field.value / 100 : ''}
                    onChange={(value) => field.onChange(toCents(value))}
                    onBlur={field.onBlur}
                    error={errors.dailyRateCents?.message}
                    errorProps={{ role: 'alert' }}
                  />
                )}
              />
            </SimpleGrid>
          </Fieldset>

          <Fieldset legend="Compensation">
            <Stack gap="sm">
              <Controller
                control={control}
                name="bonusCents"
                render={({ field }) => (
                  <NumberInput
                    {...MONEY}
                    label="Bonus"
                    inputMode="decimal"
                    value={field.value / 100}
                    onChange={(value) => field.onChange(toCents(value))}
                    onBlur={field.onBlur}
                    error={errors.bonusCents?.message}
                    errorProps={{ role: 'alert' }}
                  />
                )}
              />

              {expenses.fields.map((row, index) => (
                <Group key={row.id} gap="sm" align="flex-end" wrap="nowrap">
                  <TextInput
                    flex={1}
                    label={`Expense ${index + 1}`}
                    placeholder="Internet allowance"
                    error={errors.expenses?.[index]?.description?.message}
                    errorProps={{ role: 'alert' }}
                    {...register(`expenses.${index}.description`)}
                  />
                  <Controller
                    control={control}
                    name={`expenses.${index}.amountCents`}
                    render={({ field }) => (
                      <NumberInput
                        {...MONEY}
                        w="9rem"
                        label={`Expense ${index + 1} amount`}
                        inputMode="decimal"
                        value={field.value ? field.value / 100 : ''}
                        onChange={(value) => field.onChange(toCents(value))}
                        onBlur={field.onBlur}
                        error={errors.expenses?.[index]?.amountCents?.message}
                        errorProps={{ role: 'alert' }}
                      />
                    )}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size={36}
                    aria-label={`Remove expense ${index + 1}`}
                    onClick={() => expenses.remove(index)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              ))}

              <Group>
                <Button
                  variant="default"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => expenses.append({ description: '', amountCents: 0 })}
                >
                  Add an expense
                </Button>
              </Group>
            </Stack>
          </Fieldset>

          <Fieldset legend="Payment">
            <TextInput
              type="url"
              inputMode="url"
              label="Wise payment link"
              description="Paid in USD, with the invoice number as the reference."
              placeholder="https://wise.com/pay/..."
              required
              aria-required="true"
              error={errors.wiseLink?.message}
              errorProps={{ role: 'alert' }}
              {...register('wiseLink')}
            />
          </Fieldset>

          <Divider />
          <Stack gap={4} aria-live="polite">
            <Group justify="space-between">
              <Text size="sm">Regular compensation</Text>
              <Text size="sm">{formatUsd(totals.regularCents)}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={700}>Total amount due</Text>
              <Text fw={700}>{formatUsd(totals.totalCents)} USD</Text>
            </Group>
          </Stack>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save and print'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

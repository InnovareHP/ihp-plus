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
import { IconFileTypePdf, IconMail, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState, type BaseSyntheticEvent } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
import { useSaveStatement } from '../hooks/use-statements'
import { StatementIdentity } from './statement-identity'
import { billingStatementSchema, type BillingStatementValues } from '../schema'
import {
  formatStatementDate,
  formatUsd,
  statementFileName,
  statementTotals,
  type StatementPeriod,
} from '../utils/billing-statement'
import { deliverStatement, type StatementOutput } from '../utils/statement-output'

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

const SAVED: Record<StatementOutput, (fileName: string) => string> = {
  print: () => 'Billing statement saved — print it or save it as a PDF.',
  pdf: (fileName) => `Billing statement saved and downloaded as ${fileName}.pdf.`,
  email: () => 'Billing statement saved — open the downloaded email draft to check it and send it.',
}

const NOT_PRODUCED: Record<StatementOutput, string> = {
  print:
    'The statement is saved, but the print view would not open — allow printing for this site and print it from your statements.',
  pdf: 'The statement is saved, but the PDF could not be created — download it again from your statements.',
  email:
    'The statement is saved, but the email draft could not be created — create it again from your statements.',
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
  // Which save button was pressed, so only that one shows the pending label.
  const [pending, setPending] = useState<StatementOutput>('print')

  // Watched so the total moves as amounts are typed.
  const watched = useWatch({ control })
  const totals = statementTotals({
    fixedPay: initial.fixedPay,
    hoursWorked: watched.hoursWorked ?? 0,
    hourlyRateCents: watched.hourlyRateCents ?? 0,
    bonusCents: watched.bonusCents ?? 0,
    expenses: (watched.expenses ?? []).map((row) => ({
      description: row.description ?? '',
      amountCents: row.amountCents ?? 0,
    })),
  })

  async function submit(values: BillingStatementValues, output: StatementOutput) {
    try {
      await save.mutateAsync({ ...values, periodStart: period.from, periodEnd: period.to })
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the statement.',
      })
      return
    }

    if (!(await deliverStatement(output, values, period))) {
      setError('root', { message: NOT_PRODUCED[output] })
      return
    }

    announceSuccess(SAVED[output](statementFileName(values)))
    onClose()
  }

  function run(output: StatementOutput) {
    return (event?: BaseSyntheticEvent) => {
      setPending(output)
      return handleSubmit((values) => submit(values, output))(event)
    }
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
      <form onSubmit={run('print')} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not create the statement" />
          <Text size="sm" c="dimmed">
            Billing period {formatStatementDate(period.from)} – {formatStatementDate(period.to)}.
            Days and hours come from your timesheet; change the range above to bill a different
            period.
          </Text>

          <Fieldset legend="Contractor">
            <Stack gap="sm">
              <StatementIdentity
                name={initial.contractorName}
                position={initial.position}
                fixedPay={initial.fixedPay}
              />
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
            {initial.fixedPay ? (
              <Text size="sm" c="dimmed" mb="sm">
                You are on fixed pay, so days and hours are shown for reference and do not change
                the total.
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
                name="hourlyRateCents"
                render={({ field }) => (
                  <NumberInput
                    {...MONEY}
                    label={initial.fixedPay ? 'Fixed amount' : 'Hourly rate'}
                    required
                    aria-required="true"
                    inputMode="decimal"
                    value={field.value ? field.value / 100 : ''}
                    onChange={(value) => field.onChange(toCents(value))}
                    onBlur={field.onBlur}
                    error={errors.hourlyRateCents?.message}
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

          <Fieldset legend="Email">
            <TextInput
              type="email"
              inputMode="email"
              autoComplete="email"
              label="Send to"
              description="Who the email draft is addressed to. Leave it blank to choose in your mail app."
              placeholder="payroll@example.com"
              error={errors.sendTo?.message}
              errorProps={{ role: 'alert' }}
              {...register('sendTo')}
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
            <Button
              variant="default"
              leftSection={<IconMail size={16} />}
              onClick={run('email')}
              disabled={isSubmitting && pending !== 'email'}
              loading={isSubmitting && pending === 'email'}
            >
              {isSubmitting && pending === 'email' ? 'Saving…' : 'Save and create email'}
            </Button>
            <Button
              variant="default"
              leftSection={<IconFileTypePdf size={16} />}
              onClick={run('pdf')}
              disabled={isSubmitting && pending !== 'pdf'}
              loading={isSubmitting && pending === 'pdf'}
            >
              {isSubmitting && pending === 'pdf' ? 'Saving…' : 'Save and download PDF'}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting && pending !== 'print'}
              loading={isSubmitting && pending === 'print'}
            >
              {isSubmitting && pending === 'print' ? 'Saving…' : 'Save and print'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

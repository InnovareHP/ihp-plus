'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, NumberInput, Stack, Text } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { formatLeaveDays } from '../balance'
import { allowanceFormSchema, type AllowanceFormValues, type LeaveBalance } from '../schema'

export interface AllowanceTarget {
  userId: string
  name: string
  balance: LeaveBalance
  /** The form's own allowance, which "Use the form's" puts them back on. */
  formAllowance: number
}

export interface AllowanceModalProps {
  target: AllowanceTarget | undefined
  onClose: () => void
  /** Undefined days puts the person back on the form's allowance. */
  onSave: (target: AllowanceTarget, days: number | undefined) => void
}

function AllowanceForm({
  target,
  onClose,
  onSave,
}: {
  target: AllowanceTarget
  onClose: () => void
  onSave: AllowanceModalProps['onSave']
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AllowanceFormValues>({
    resolver: zodResolver(allowanceFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { days: target.balance.allowance },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => {
        onSave(target, values.days)
        onClose()
      })}
      noValidate
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {target.balance.formName} gives everyone {formatLeaveDays(target.formAllowance)} a year.
          {target.balance.used > 0
            ? ` ${target.name} has used ${formatLeaveDays(target.balance.used)} so far.`
            : ''}
        </Text>
        <Controller
          control={control}
          name="days"
          render={({ field }) => (
            <NumberInput
              label="Days per year"
              required
              aria-required="true"
              min={0}
              max={366}
              allowDecimal={false}
              allowNegative={false}
              value={field.value}
              onChange={(value) => field.onChange(typeof value === 'number' ? value : undefined)}
              onBlur={field.onBlur}
              error={errors.days?.message}
              errorProps={{ role: 'alert' }}
              data-autofocus
            />
          )}
        />
        <Group justify="flex-end" wrap="wrap" gap="xs">
          {target.balance.overridden ? (
            <Button
              variant="subtle"
              onClick={() => {
                onSave(target, undefined)
                onClose()
              }}
            >
              Use the form’s {target.formAllowance} days
            </Button>
          ) : null}
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save allowance</Button>
        </Group>
      </Stack>
    </form>
  )
}

/** One person's own allowance on one form, replacing the form's number for them alone. */
export function AllowanceModal({ target, onClose, onSave }: AllowanceModalProps) {
  return (
    <Modal
      opened={target !== undefined}
      onClose={onClose}
      title={target ? `${target.name}’s ${target.balance.formName}` : ''}
      closeButtonProps={{ 'aria-label': 'Close' }}
      centered
    >
      {/* Keyed so each opening starts from that person's own allowance. */}
      {target ? (
        <AllowanceForm
          key={`${target.userId}:${target.balance.formId}`}
          target={target}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  )
}

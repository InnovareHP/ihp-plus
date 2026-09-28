'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Button,
  Fieldset,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { announceSuccess } from '@/lib/announce'
import { useInterviewers, useOfferInterview } from '../hooks/use-interviews'
import {
  INTERVIEW_DURATIONS,
  INTERVIEW_FORMAT_LABELS,
  INTERVIEW_FORMATS,
  MAX_INTERVIEW_SLOTS,
  offerInterviewSchema,
  type ApplicationSummary,
  type OfferInterviewInput,
  type OfferInterviewValues,
} from '../schema'
import { FreeTimeSuggestions } from './free-time-suggestions'

const LOCATION_LABEL = {
  video: {
    label: 'Video link',
    help: 'Paste the meeting link, or leave it empty and send it later.',
  },
  onsite: { label: 'Address', help: 'Where they should come, with a floor or room if it helps.' },
  phone: { label: 'Calling from', help: 'Optional. We call the number they applied with.' },
} as const

export interface ScheduleInterviewModalProps {
  application: ApplicationSummary
  /** The organization's zone, which every time typed here is read in. */
  timeZone: string
  onClose: () => void
}

export function ScheduleInterviewModal({
  application,
  timeZone,
  onClose,
}: ScheduleInterviewModalProps) {
  const interviewers = useInterviewers()
  const offer = useOfferInterview(timeZone)

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OfferInterviewInput, unknown, OfferInterviewValues>({
    resolver: zodResolver(offerInterviewSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      applicationId: application.id,
      format: 'video',
      location: '',
      note: '',
      durationMinutes: 45,
      interviewerIds: [],
      slots: [{ date: '', time: '' }],
    },
  })
  const slots = useFieldArray({ control, name: 'slots' })
  const format = useWatch({ control, name: 'format' }) ?? 'video'
  const interviewerIds = useWatch({ control, name: 'interviewerIds' }) ?? []
  const durationMinutes = Number(useWatch({ control, name: 'durationMinutes' }) ?? 45)

  // A suggestion fills the first empty row before it adds one, so the blank starter row is used.
  function addSuggested(slot: { date: string; time: string }) {
    const empty = (getValues('slots') ?? []).findIndex((row) => !row.date && !row.time)
    if (empty >= 0) slots.update(empty, slot)
    else if (slots.fields.length < MAX_INTERVIEW_SLOTS) slots.append(slot)
  }
  const place = LOCATION_LABEL[format]

  async function onSubmit(values: OfferInterviewValues) {
    try {
      await offer.mutateAsync(values)
      announceSuccess(
        `${application.fullName} was sent ${values.slots.length === 1 ? 'the time' : 'the times'} to pick from.`,
      )
      onClose()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not offer those times.',
      })
    }
  }

  return (
    <Modal opened onClose={onClose} title={`Interview ${application.fullName}`} size="lg" centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not offer those times" />

          <Controller
            control={control}
            name="format"
            render={({ field }) => (
              <Stack gap={4}>
                <Text size="sm" fw={500} id="interview-format-label">
                  Format
                </Text>
                <SegmentedControl
                  aria-labelledby="interview-format-label"
                  value={field.value}
                  onChange={field.onChange}
                  data={INTERVIEW_FORMATS.map((value) => ({
                    value,
                    label: INTERVIEW_FORMAT_LABELS[value],
                  }))}
                />
              </Stack>
            )}
          />

          <TextInput
            {...register('location')}
            label={place.label}
            description={place.help}
            required={format === 'onsite'}
            aria-required={format === 'onsite' || undefined}
            error={errors.location?.message}
            errorProps={{ role: 'alert' }}
          />

          <Group grow align="flex-start">
            <Controller
              control={control}
              name="durationMinutes"
              render={({ field }) => (
                <Select
                  label="Length"
                  allowDeselect={false}
                  data={INTERVIEW_DURATIONS.map((minutes) => ({
                    value: String(minutes),
                    label: `${minutes} minutes`,
                  }))}
                  value={String(field.value ?? 45)}
                  onChange={(value) => field.onChange(Number(value ?? 45))}
                />
              )}
            />
            <Controller
              control={control}
              name="interviewerIds"
              render={({ field }) => (
                <MultiSelect
                  label="Interviewers"
                  placeholder={interviewers.isPending ? 'Loading…' : 'Who will be there'}
                  searchable
                  required
                  aria-required="true"
                  disabled={interviewers.isPending}
                  data={(interviewers.data ?? []).map((person) => ({
                    value: person.userId,
                    label: person.name,
                  }))}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.interviewerIds?.message}
                />
              )}
            />
          </Group>

          <Fieldset legend={`Times to offer, in ${timeZone}`} variant="unstyled">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                They pick one on their status page, where each time shows in their own zone.
              </Text>
              <FreeTimeSuggestions
                interviewerIds={interviewerIds}
                durationMinutes={durationMinutes}
                timeZone={timeZone}
                onPick={addSuggested}
              />
              {errors.slots?.message || errors.slots?.root?.message ? (
                <Text size="sm" c="red" role="alert">
                  {errors.slots?.message ?? errors.slots?.root?.message}
                </Text>
              ) : null}
              {slots.fields.map((slot, index) => (
                <Group key={slot.id} align="flex-end" gap="sm" wrap="nowrap">
                  <TextInput
                    {...register(`slots.${index}.date`)}
                    type="date"
                    label={`Day, option ${index + 1}`}
                    required
                    aria-required="true"
                    error={errors.slots?.[index]?.date?.message}
                    errorProps={{ role: 'alert' }}
                    flex={1}
                  />
                  <TextInput
                    {...register(`slots.${index}.time`)}
                    type="time"
                    label={`Time, option ${index + 1}`}
                    required
                    aria-required="true"
                    error={errors.slots?.[index]?.time?.message}
                    errorProps={{ role: 'alert' }}
                    flex={1}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    mb={4}
                    aria-label={`Remove option ${index + 1}`}
                    disabled={slots.fields.length === 1}
                    onClick={() => slots.remove(index)}
                  >
                    <IconTrash size={16} aria-hidden />
                  </ActionIcon>
                </Group>
              ))}
              <Button
                variant="default"
                size="compact-sm"
                w="fit-content"
                leftSection={<IconPlus size={14} aria-hidden />}
                disabled={slots.fields.length >= MAX_INTERVIEW_SLOTS}
                onClick={() => slots.append({ date: '', time: '' })}
              >
                Add another time
              </Button>
            </Stack>
          </Fieldset>

          <Textarea
            {...register('note')}
            label="Note to the applicant"
            description="Optional: what to bring, who they will meet, how long to allow."
            autosize
            minRows={2}
            error={errors.note?.message}
            errorProps={{ role: 'alert' }}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send times to pick from'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

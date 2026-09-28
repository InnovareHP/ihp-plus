'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Anchor,
  Button,
  Group,
  Paper,
  Radio,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { FormError } from '@/components/form-error'
import { useAskForOtherTimes, useBookInterview } from '../hooks/use-interviews'
import { INTERVIEW_FORMAT_LABELS, type InterviewOffer } from '../schema'
import { formatInterviewTime, timeZoneOptions } from '../utils/interview-time'

// The browser's own zone is an external value the server cannot know, so it is read after hydration.
function subscribe() {
  return () => {}
}
function browserZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

const pickSchema = z.object({
  slotId: z.string().min(1, 'Choose one of the times.'),
  timeZone: z.string().default(''),
})

type PickInput = z.input<typeof pickSchema>
type PickValues = z.infer<typeof pickSchema>

export interface InterviewPickerProps {
  offer: InterviewOffer
  applicationId: string
  signature: string
}

export function InterviewPicker({ offer, applicationId, signature }: InterviewPickerProps) {
  const router = useRouter()
  const detected = useSyncExternalStore(subscribe, browserZone, () => null)
  const book = useBookInterview()
  const askAgain = useAskForOtherTimes()

  const { control, handleSubmit, setError, formState } = useForm<PickInput, unknown, PickValues>({
    resolver: zodResolver(pickSchema),
    mode: 'onTouched',
    defaultValues: { slotId: '', timeZone: '' },
  })
  const chosenZone = useWatch({ control, name: 'timeZone' }) || detected || 'UTC'

  async function onBook(values: PickValues) {
    try {
      await book.mutateAsync({
        applicationId,
        signature,
        interviewId: offer.id,
        slotId: values.slotId,
        timeZone: values.timeZone || chosenZone,
      })
      router.refresh()
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not book that time.',
      })
    }
  }

  function onNoneWork() {
    askAgain.mutate(
      { applicationId, signature, interviewId: offer.id },
      { onSuccess: () => router.refresh() },
    )
  }

  const where =
    offer.format === 'onsite'
      ? `In person at ${offer.location}`
      : offer.format === 'phone'
        ? 'A phone call; we will ring the number you applied with.'
        : offer.joinUrl || offer.location
          ? 'A video call; the link is below and in your calendar invite.'
          : 'A video call; the link follows by email.'

  const zonePicker = (
    <Controller
      control={control}
      name="timeZone"
      render={({ field }) => (
        <Select
          label="Your time zone"
          description="Every time below is shown in it."
          searchable
          allowDeselect={false}
          data={timeZoneOptions(chosenZone)}
          value={chosenZone}
          onChange={(value) => field.onChange(value ?? '')}
          maw={320}
        />
      )}
    />
  )

  return (
    <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }}>
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} size="h4">
            {offer.status === 'booked' ? 'Your interview' : 'Pick a time for your interview'}
          </Title>
          <Text size="sm" c="dimmed">
            {INTERVIEW_FORMAT_LABELS[offer.format]} · {offer.durationMinutes} minutes. {where}
          </Text>
          {offer.note ? <Text size="sm">{offer.note}</Text> : null}
        </Stack>

        {offer.status === 'booked' && offer.bookedStart ? (
          <Stack gap="sm">
            <Text fw={600}>{formatInterviewTime(offer.bookedStart, chosenZone)}</Text>
            {offer.joinUrl || (offer.format === 'video' && offer.location) ? (
              <Anchor href={offer.joinUrl ?? offer.location} target="_blank" rel="noopener">
                Join the call
              </Anchor>
            ) : null}
            {zonePicker}
            <Group>
              <Button
                variant="subtle"
                color="gray"
                loading={askAgain.isPending}
                onClick={onNoneWork}
              >
                I can no longer make this time
              </Button>
            </Group>
          </Stack>
        ) : null}

        {offer.status === 'reschedule_requested' ? (
          <Alert color="blue" variant="light">
            Thanks for letting us know. We will email you new times to pick from.
          </Alert>
        ) : null}

        {offer.status === 'offered' ? (
          offer.slots.length === 0 ? (
            <Stack gap="sm">
              <Text size="sm">Every time we offered has passed.</Text>
              <Button
                w="fit-content"
                variant="light"
                loading={askAgain.isPending}
                onClick={onNoneWork}
              >
                Ask for new times
              </Button>
            </Stack>
          ) : (
            <form onSubmit={handleSubmit(onBook)} noValidate>
              <Stack gap="md">
                <FormError
                  message={formState.errors.root?.message}
                  title="Could not book that time"
                />
                {zonePicker}
                <Controller
                  control={control}
                  name="slotId"
                  render={({ field }) => (
                    <Radio.Group
                      label="Choose a time"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      error={formState.errors.slotId?.message}
                      errorProps={{ role: 'alert' }}
                    >
                      <Stack gap="xs" mt="xs">
                        {offer.slots.map((slot) => (
                          <Radio
                            key={slot.id}
                            value={slot.id}
                            label={formatInterviewTime(slot.start, chosenZone)}
                          />
                        ))}
                      </Stack>
                    </Radio.Group>
                  )}
                />
                <Group>
                  <Button type="submit" loading={formState.isSubmitting}>
                    {formState.isSubmitting ? 'Booking…' : 'Book this time'}
                  </Button>
                  <Button
                    variant="subtle"
                    color="gray"
                    loading={askAgain.isPending}
                    onClick={onNoneWork}
                  >
                    None of these work
                  </Button>
                </Group>
              </Stack>
            </form>
          )
        ) : null}

        {askAgain.error ? (
          <Text size="sm" c="red" role="alert">
            {askAgain.error.message}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  )
}

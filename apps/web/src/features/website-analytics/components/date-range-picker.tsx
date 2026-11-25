'use client'

import { Button, Divider, Flex, Group, Input, Popover, Stack, Text } from '@mantine/core'
import { DatePicker } from '@mantine/dates'
import { useMediaQuery } from '@mantine/hooks'
import { IconCalendar } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { daysIn, shiftDay, type DayRange } from '../days'
import {
  customRangeProblem,
  FIRST_REPORT_DAY,
  PRESET_LABELS,
  presetRange,
  RANGE_PRESETS,
  rangeLabel,
  type RangePreset,
} from '../report-range'

type Picked = [string | null, string | null]

// Mantine ships the arrows unnamed, which leaves a screen reader with two blank buttons.
const CALENDAR_LABELS = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  previousYear: 'Previous year',
  nextYear: 'Next year',
  previousDecade: 'Previous decade',
  nextDecade: 'Next decade',
  monthLevelControl: 'Pick a month',
  yearLevelControl: 'Pick a year',
}

interface Draft {
  preset: RangePreset
  picked: Picked
  /** The month on the left of the calendar. */
  month: string
}

export interface DateRangePickerProps {
  preset: RangePreset
  range: DayRange
  today: string
  onApply: (preset: RangePreset, range: DayRange) => void
}

// With two months the range's last month sits on the right; with one it is the month shown.
function monthFor(range: DayRange, columns: number) {
  const endMonth = `${range.end.slice(0, 7)}-01`
  return columns === 2 ? shiftDay(endMonth, -1).slice(0, 7) + '-01' : endMonth
}

function dayCount(range: DayRange) {
  const days = daysIn(range)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export function DateRangePicker({ preset, range, today, onApply }: DateRangePickerProps) {
  const labelId = useId()
  const valueId = useId()
  // Two months side by side need about 560px, more than a phone has.
  const columns = useMediaQuery('(min-width: 48em)') ? 2 : 1
  // The draft is the open popover's own scratch state; nothing reaches the view until Apply.
  const [draft, setDraft] = useState<Draft | null>(null)

  const lastDay = shiftDay(today, -1)
  const [start, end] = draft?.picked ?? [null, null]
  const problem = start && end ? customRangeProblem({ start, end }, today) : null

  function open() {
    setDraft({ preset, picked: [range.start, range.end], month: monthFor(range, columns) })
  }

  function choosePreset(next: RangePreset) {
    if (!draft) return
    if (next === 'custom') {
      setDraft({ ...draft, preset: 'custom', picked: [null, null] })
      return
    }
    const nextRange = presetRange(next, today)
    setDraft({
      preset: next,
      picked: [nextRange.start, nextRange.end],
      month: monthFor(nextRange, columns),
    })
  }

  function apply() {
    if (!start || !end || problem) return
    onApply(draft?.preset ?? 'custom', { start, end })
    setDraft(null)
  }

  // The heading carries every hint, so Apply never fails without saying why.
  const heading =
    problem ??
    (start && end
      ? `${rangeLabel({ start, end })} · ${dayCount({ start, end })}`
      : start
        ? 'Pick an end date'
        : 'Pick a start date')

  return (
    <Input.Wrapper
      label="Date range"
      labelProps={{ id: labelId, component: 'span' }}
      w={{ base: '100%', sm: 'auto' }}
    >
      <Popover
        opened={draft !== null}
        onChange={(opened) => (opened ? open() : setDraft(null))}
        position="bottom-start"
        shadow="md"
        trapFocus
        returnFocus
      >
        <Popover.Target>
          <Button
            variant="default"
            leftSection={<IconCalendar size={16} aria-hidden />}
            onClick={() => (draft ? setDraft(null) : open())}
            aria-labelledby={`${labelId} ${valueId}`}
            fw={400}
            // Block-level, so the inline label above it keeps its own line.
            display="flex"
            w={{ base: '100%', sm: 'auto' }}
            justify="flex-start"
            // Lets a long range wrap on a phone instead of being cut off mid-date.
            h="auto"
            mih={36}
            py={6}
            styles={{ label: { whiteSpace: 'normal', textAlign: 'left' } }}
          >
            <span id={valueId}>
              {PRESET_LABELS[preset]}
              {' · '}
              {rangeLabel(range)}
            </span>
          </Button>
        </Popover.Target>

        <Popover.Dropdown p={0} maw="calc(100vw - 2rem)">
          {draft ? (
            <Stack gap={0}>
              <Text ta="center" fw={600} py="sm" px="md" aria-live="polite">
                {heading}
              </Text>
              <Divider />

              <Flex direction={{ base: 'column', sm: 'row' }}>
                {/* A wrapping row on a phone keeps the calendar on screen; a column beside it otherwise. */}
                <Flex
                  component="ul"
                  aria-label="Quick ranges"
                  direction={{ base: 'row', sm: 'column' }}
                  wrap="wrap"
                  gap={4}
                  p="xs"
                  m={0}
                  miw={{ sm: 150 }}
                  style={{ listStyle: 'none' }}
                >
                  {RANGE_PRESETS.map((option) => (
                    <li key={option}>
                      <Button
                        variant={draft.preset === option ? 'light' : 'subtle'}
                        color={draft.preset === option ? undefined : 'gray'}
                        // Mantine's gray label is 3.3:1 on white; body text keeps AA in both themes.
                        c={draft.preset === option ? undefined : 'var(--mantine-color-text)'}
                        aria-pressed={draft.preset === option}
                        onClick={() => choosePreset(option)}
                        justify="flex-start"
                        w={{ base: 'auto', sm: '100%' }}
                        fw={draft.preset === option ? 600 : 400}
                      >
                        {PRESET_LABELS[option]}
                      </Button>
                    </li>
                  ))}
                </Flex>

                <Divider hiddenFrom="sm" />
                <Divider orientation="vertical" visibleFrom="sm" />

                <Flex p="sm" justify="center">
                  <DatePicker
                    type="range"
                    value={draft.picked}
                    onChange={(picked) =>
                      setDraft({ ...draft, preset: 'custom', picked: picked as Picked })
                    }
                    date={draft.month}
                    onDateChange={(month) => setDraft({ ...draft, month })}
                    numberOfColumns={columns}
                    columnsToScroll={1}
                    minDate={FIRST_REPORT_DAY}
                    maxDate={lastDay}
                    firstDayOfWeek={0}
                    allowSingleDateInRange
                    ariaLabels={CALENDAR_LABELS}
                    // Mantine paints weekends red, which reads as an error and fails AA on the range tint.
                    weekendDays={[]}
                  />
                </Flex>
              </Flex>

              <Divider />
              <Group justify="flex-end" gap="xs" p="sm">
                <Button variant="default" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button onClick={apply}>Apply</Button>
              </Group>
            </Stack>
          ) : null}
        </Popover.Dropdown>
      </Popover>
    </Input.Wrapper>
  )
}

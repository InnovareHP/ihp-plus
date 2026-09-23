export interface HolidayEntry {
  date: string
  name: string
  /** Empty for a day off everyone gets. */
  country: string
}

/** A company-wide day off applies to every shift; a country's applies only to shifts following it. */
export function holidayAppliesTo(holidayCountry: string, shiftCountry: string) {
  return holidayCountry === '' || holidayCountry === shiftCountry
}

/** The holiday somebody on a shift following `shiftCountry` has on `date`, if any. */
export function holidayFor(
  holidays: readonly HolidayEntry[],
  date: string,
  shiftCountry: string,
): HolidayEntry | undefined {
  // The shift's own country names the day ahead of a company-wide entry on the same date.
  const matching = holidays.filter(
    (one) => one.date === date && holidayAppliesTo(one.country, shiftCountry),
  )
  return matching.find((one) => one.country !== '') ?? matching[0]
}

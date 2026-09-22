/** Coordinates to one decimal place under a metre, and never enough to block a punch. */
export async function currentLocation(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return ''

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve(`${position.coords.latitude.toFixed(5)},${position.coords.longitude.toFixed(5)}`),
      // A refused or failed fix is not a reason to keep somebody off the clock.
      () => resolve(''),
      { timeout: 8000, maximumAge: 60_000 },
    )
  })
}

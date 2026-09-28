// Fire-and-forget: a missed rebuild only leaves the static careers list stale until the next one.
export function requestLandingRebuild(reason: string) {
  const hook = process.env.LANDING_DEPLOY_HOOK_URL
  if (!hook) return

  void fetch(hook, { method: 'POST' })
    .then((response) => {
      if (!response.ok)
        console.error(`[hiring] landing rebuild (${reason}) answered ${response.status}`)
    })
    .catch((error: unknown) => {
      console.error(`[hiring] landing rebuild (${reason}) failed`, error)
    })
}

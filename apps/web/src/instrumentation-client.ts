import posthog from 'posthog-js'

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

// No key means no analytics, so local development and unconfigured builds stay silent.
if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    // The funnel events are explicit track() calls; recording and autocapture could sweep up member data.
    autocapture: false,
    disable_session_recording: true,
    capture_pageview: 'history_change',
  })
}

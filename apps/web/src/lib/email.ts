export interface OutboundEmail {
  to: string
  subject: string
  text: string
}

// No transactional provider is wired yet, so mail is logged; see EMAIL_* in .env.example.
export async function sendEmail({ to, subject, text }: OutboundEmail) {
  console.warn(`[email:unsent] to=${to} subject="${subject}"\n${text}`)
}

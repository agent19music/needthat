import { env } from 'cloudflare:workers'
import * as Sentry from '@sentry/tanstackstart-react'

type MailEnv = {
  RESEND_API_KEY?: string
  RESEND_FROM?: string
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super('Password reset email is not configured.')
    this.name = 'MailNotConfiguredError'
  }
}

export async function sendAuthEmail(input: {
  to: string
  subject: string
  text: string
  html: string
}) {
  return Sentry.startSpan({ name: 'Sending an account email' }, async () => {
    const mail = env as typeof env & MailEnv
    const apiKey = mail.RESEND_API_KEY?.trim()
    const from = mail.RESEND_FROM?.trim()
    if (!apiKey || !from) {
      console.info(`Auth email not sent to ${input.to}. ${input.text}`)
      throw new MailNotConfiguredError()
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    })
    if (!response.ok) {
      throw new Error('The email could not be sent.')
    }
  })
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

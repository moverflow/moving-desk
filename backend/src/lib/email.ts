import { Resend } from 'resend'
import { env } from './env'
import { logger } from './logger'

const resend = new Resend(env.RESEND_API_KEY)

export function sendWelcomeEmail(email: string, name: string): void {
  resend.emails
    .send({
      from: 'MovingDesk <hello@movingdesk.app>',
      to: email,
      subject: 'Welcome to MovingDesk — your 14-day trial starts now',
      text: `Hi ${name},\n\nYour 14-day free trial has started. Log in at ${env.FRONTEND_URL}\n\nThe MovingDesk Team`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send welcome email')
    })
}

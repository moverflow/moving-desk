import { Resend } from 'resend'
import { env } from './env.js'
import { logger } from './logger.js'

const resend = new Resend(env.RESEND_API_KEY)

export function sendInvoiceEmail(params: {
  to: string
  clientName: string
  companyName: string
  invoiceNumber: string
  shareToken: string
}): void {
  const shareUrl = `${env.FRONTEND_URL}/i/${params.shareToken}`
  resend.emails
    .send({
      from: 'MovingDesk <hello@movingdesk.app>',
      to: params.to,
      subject: `Invoice ${params.invoiceNumber} from ${params.companyName}`,
      text: `Hi ${params.clientName},\n\nYour invoice ${params.invoiceNumber} is ready:\n${shareUrl}\n\nThis link expires in 7 days.\n\nThank you,\n${params.companyName}`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send invoice email')
    })
}

export function sendInviteEmail(email: string, token: string): void {
  resend.emails
    .send({
      from: 'MovingDesk <hello@movingdesk.app>',
      to: email,
      subject: "You've been invited to MovingDesk",
      text: `You've been invited to join MovingDesk.\n\nClick to accept: ${env.FRONTEND_URL}/join?token=${token}\n\nThis link expires in 48 hours.`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send invite email')
    })
}

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

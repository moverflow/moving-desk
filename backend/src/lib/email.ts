import { Resend } from 'resend'
import { env } from './env.js'
import { logger } from './logger.js'

const resend = new Resend(env.RESEND_API_KEY)

const FROM = env.EMAIL_FROM

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
      from: FROM,
      to: params.to,
      subject: `Invoice ${params.invoiceNumber} from ${params.companyName}`,
      text: `Hi ${params.clientName},\n\nYour invoice ${params.invoiceNumber} is ready:\n${shareUrl}\n\nThis link expires in 7 days.\n\nThank you,\n${params.companyName}`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send invoice email')
    })
}

export function sendBookingConfirmation(params: {
  to: string
  clientName: string
  companyName: string
  companyPhone: string | null
  moveDate: string
  fromAddress: string
  toAddress: string
  estimatedPrice: number
}): void {
  const price = `$${params.estimatedPrice.toLocaleString('en-US')}`
  const phoneLine = params.companyPhone ? `\n\nQuestions? Call us: ${params.companyPhone}` : ''
  resend.emails
    .send({
      from: FROM,
      to: params.to,
      subject: `Your move is booked with ${params.companyName}!`,
      text: `Hi ${params.clientName},\n\nYour move is booked. ${params.companyName} will be in touch to confirm the details.\n\nMove date: ${params.moveDate}\nFrom: ${params.fromAddress}\nTo: ${params.toAddress}\nEstimated price: ${price}${phoneLine}\n\nThank you,\n${params.companyName}`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send booking confirmation email')
    })
}

export function sendContractEmail(params: {
  to: string
  clientName: string
  companyName: string
  moveDate: string
  contractUrl: string
}): void {
  resend.emails
    .send({
      from: FROM,
      to: params.to,
      subject: `Please sign your moving contract with ${params.companyName}`,
      text: `Hi ${params.clientName},\n\nYour move on ${params.moveDate} is confirmed. Please review and sign your moving service agreement:\n${params.contractUrl}\n\nIt only takes a minute.\n\nThank you,\n${params.companyName}`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send contract email')
    })
}

export function sendContractSignedNotification(params: {
  to: string
  clientName: string
  moveDate: string
  orderUrl: string
}): void {
  resend.emails
    .send({
      from: FROM,
      to: params.to,
      subject: `✅ ${params.clientName} signed the contract for ${params.moveDate} move`,
      text: `${params.clientName} has signed the moving contract.\n\nMove date: ${params.moveDate}\n\nView the order in MovingDesk:\n${params.orderUrl}`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send contract signed notification')
    })
}

export function sendPaymentConfirmationEmail(params: {
  to: string
  clientName: string
  companyName: string
  amount: number
  moveDate: string
  invoiceNumber: string
}): void {
  const price = `$${params.amount.toLocaleString('en-US')}`
  resend.emails
    .send({
      from: FROM,
      to: params.to,
      subject: `Payment received — ${params.invoiceNumber}`,
      text: `Hi ${params.clientName},\n\nWe received your payment of ${price} for your move on ${params.moveDate}.\n\nThank you!\n${params.companyName}`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send payment confirmation email')
    })
}

// Awaited (not fire-and-forget) so the daily reminder job can mark an order as
// reminded only after a successful send and continue past a single failure.
export async function sendMoveReminderEmail(params: {
  to: string
  clientName: string
  companyName: string
  companyPhone: string | null
  moveDate: string
  fromAddress: string
  toAddress: string
}): Promise<void> {
  const phoneLine = params.companyPhone
    ? `\n\nIf you need to make any changes, call us: ${params.companyPhone}`
    : ''
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Reminder: Your move is tomorrow!',
    text: `Hi ${params.clientName},\n\nJust a reminder that your move is scheduled for tomorrow, ${params.moveDate}.\n\nMove details:\nFrom: ${params.fromAddress}\nTo:   ${params.toAddress}\n\nPlease make sure everything is packed and ready.${phoneLine}\n\nSee you tomorrow!\n${params.companyName}`,
  })
}

export async function sendMoveCompletedEmail(params: {
  to: string
  clientName: string
  companyName: string
  companyPhone: string | null
  moveDate: string
  invoiceUrl: string | null
}): Promise<void> {
  const invoiceBlock = params.invoiceUrl
    ? `\n\nYour invoice is ready for payment:\n${params.invoiceUrl}`
    : ''
  const phoneLine = params.companyPhone ? `\n\nQuestions? Call us: ${params.companyPhone}` : ''
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Your move is complete — thank you!',
    text: `Hi ${params.clientName},\n\nYour move on ${params.moveDate} has been completed successfully.\nThank you for choosing ${params.companyName}!${invoiceBlock}\n\nWe'd love to hear about your experience — feel free to leave us a review. It means a lot to our small business.${phoneLine}\n\nBest regards,\n${params.companyName}`,
  })
}

// Awaited so the lead reminder job marks a lead as reminded only after a
// successful send and continues past a single failure.
export async function sendLeadReminderEmail(params: {
  to: string
  ownerName: string
  leadName: string
  leadPhone: string | null
  leadSource: string
  createdAt: Date
  leadsUrl: string
}): Promise<void> {
  const received = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(params.createdAt)
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `⚡ New lead hasn't been contacted yet — ${params.leadName}`,
    text: `Hi ${params.ownerName},\n\nYou have a lead that hasn't been contacted in over 24 hours:\n\nName:     ${params.leadName}\nPhone:    ${params.leadPhone ?? '—'}\nSource:   ${params.leadSource}\nReceived: ${received}\n\nDon't let this opportunity slip away!\n\nView leads → ${params.leadsUrl}\n\nMovingDesk`,
  })
}

export function sendInviteEmail(email: string, token: string): void {
  resend.emails
    .send({
      from: FROM,
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
      from: FROM,
      to: email,
      subject: 'Welcome to MovingDesk — your 14-day trial starts now',
      text: `Hi ${name},\n\nYour 14-day free trial has started. Log in at ${env.FRONTEND_URL}\n\nThe MovingDesk Team`,
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Failed to send welcome email')
    })
}

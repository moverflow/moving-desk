import Anthropic from '@anthropic-ai/sdk'
import { env } from './env.js'

export const AI_MODEL = 'claude-sonnet-4-6'

// The Telegram Mini App assistant takes real actions through tool calls, so it
// runs on the strongest model rather than the dashboard-insights one above.
export const ASSISTANT_MODEL = 'claude-opus-5'

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export function isAIConfigured(): boolean {
  return env.ANTHROPIC_API_KEY.length > 0
}

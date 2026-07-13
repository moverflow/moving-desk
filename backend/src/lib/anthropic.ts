import Anthropic from '@anthropic-ai/sdk'
import { env } from './env.js'

export const AI_MODEL = 'claude-sonnet-4-6'

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export function isAIConfigured(): boolean {
  return env.ANTHROPIC_API_KEY.length > 0
}

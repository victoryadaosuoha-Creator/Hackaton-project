import { describe, expect, it } from 'vitest'
import { draftAssistantReply } from './assistant'

describe('assistant drafting', () => {
  it('classifies drainage language as a suggestion', () => {
    const result = draftAssistantReply('The drain is blocked and water floods the path')
    expect(result.category).toBe('water_drainage')
    expect(result.reply.toLowerCase()).toContain('suggestion')
  })

  it('does not invent a live AI service', () => {
    const result = draftAssistantReply('something unclear')
    expect(result.reply.toLowerCase()).toContain('demo')
  })
})

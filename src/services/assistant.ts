import { CATEGORY_LABELS } from '@/data/catalog'
import type { ReportCategory } from '@/data/types'

type Suggestion = {
  reply: string
  category?: ReportCategory
  title?: string
  summary?: string
}

const rules: Array<{ test: RegExp; suggestion: Suggestion }> = [
  {
    test: /drain|flood|water|gutter/i,
    suggestion: {
      reply:
        'That sounds like a water and drainage issue. Mention the street, how long water has been standing, and whether it blocks a path or road.',
      category: 'water_drainage',
      title: 'Blocked or overflowing drainage',
      summary: 'Standing water or a blocked drain affecting a public area.',
    },
  },
  {
    test: /bin|garbage|waste|rubbish|dump/i,
    suggestion: {
      reply:
        'This fits waste and sanitation. Note the nearest landmark, whether the bin is overflowing, and if it is a communal collection point.',
      category: 'waste_sanitation',
      title: 'Overflowing waste collection point',
      summary: 'Uncollected or overflowing waste at a public collection point.',
    },
  },
  {
    test: /pothole|road|highway|traffic/i,
    suggestion: {
      reply:
        'This looks like roads and transport. Describe the damage, how it affects vehicles or pedestrians, and a nearby junction.',
      category: 'roads_transport',
      title: 'Damaged road surface',
      summary: 'Road damage that is affecting traffic or pedestrian safety.',
    },
  },
  {
    test: /light|electric|dark|lamp/i,
    suggestion: {
      reply:
        'This appears to be electricity or streetlights. Say how many lights are out and whether the area is a walkway, junction, or clinic path.',
      category: 'electricity_streetlights',
      title: 'Streetlight not working',
      summary: 'Public lighting outage reducing night-time safety.',
    },
  },
]

export function draftAssistantReply(message: string): Suggestion {
  const hit = rules.find((rule) => rule.test.test(message))
  if (hit) {
    const category = hit.suggestion.category
    return {
      ...hit.suggestion,
      reply: `${hit.suggestion.reply}${category ? ` Suggested category: ${CATEGORY_LABELS[category]}.` : ''} This is a scripted demo suggestion, not a live AI service.`,
    }
  }
  return {
    reply:
      'I can help you phrase a civic report. Describe the problem, the locality, and a nearby landmark. Suggested questions: “How do I report a blocked drain?” or “What category is an overflowing bin?” This assistant is simulated demo mode only.',
  }
}

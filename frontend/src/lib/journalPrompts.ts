// ---- Journal section definitions ----

export type SectionType = 'mood' | 'energy' | 'textarea'

export interface JournalSection {
  promptKey: string
  prompt: string
  type: SectionType
  placeholder?: string
}

export const JOURNAL_SECTIONS: JournalSection[] = [
  { promptKey: 'mood', prompt: 'Mood', type: 'mood' },
  { promptKey: 'energy', prompt: 'Energy', type: 'energy' },
  { promptKey: 'wins', prompt: "What went well today? Any wins, progress, or things you're proud of?", type: 'textarea', placeholder: 'Even small wins count...' },
  { promptKey: 'challenges', prompt: 'What was difficult? What did you learn or want to do differently?', type: 'textarea', placeholder: 'Struggles, lessons, or things on your mind...' },
  { promptKey: 'intention', prompt: "What's your main intention or focus for tomorrow?", type: 'textarea', placeholder: 'One thing you want to focus on...' },
]

export interface SelectorOption {
  value: string
  label: string
  color: string
  activeColor: string
}

export const MOOD_OPTIONS: SelectorOption[] = [
  { value: 'great', label: 'Great', color: 'border-emerald-500/30 text-emerald-700', activeColor: 'bg-emerald-500/15 border-emerald-500 text-emerald-700' },
  { value: 'good', label: 'Good', color: 'border-green-500/30 text-green-700', activeColor: 'bg-green-500/15 border-green-500 text-green-700' },
  { value: 'okay', label: 'Okay', color: 'border-amber-500/30 text-amber-700', activeColor: 'bg-amber-500/15 border-amber-500 text-amber-700' },
  { value: 'low', label: 'Low', color: 'border-orange-500/30 text-orange-700', activeColor: 'bg-orange-500/15 border-orange-500 text-orange-700' },
  { value: 'rough', label: 'Rough', color: 'border-red-500/30 text-red-700', activeColor: 'bg-red-500/15 border-red-500 text-red-700' },
]

export const ENERGY_OPTIONS: SelectorOption[] = [
  { value: 'high', label: 'High', color: 'border-blue-500/30 text-blue-700', activeColor: 'bg-blue-500/15 border-blue-500 text-blue-700' },
  { value: 'good', label: 'Good', color: 'border-sky-500/30 text-sky-700', activeColor: 'bg-sky-500/15 border-sky-500 text-sky-700' },
  { value: 'moderate', label: 'Moderate', color: 'border-indigo-500/30 text-indigo-700', activeColor: 'bg-indigo-500/15 border-indigo-500 text-indigo-700' },
  { value: 'low', label: 'Low', color: 'border-violet-500/30 text-violet-700', activeColor: 'bg-violet-500/15 border-violet-500 text-violet-700' },
  { value: 'drained', label: 'Drained', color: 'border-purple-500/30 text-purple-700', activeColor: 'bg-purple-500/15 border-purple-500 text-purple-700' },
]

// ---- Matching saved data ----

export interface PromptEntry {
  prompt: string
  promptKey?: string
}

/**
 * Match saved responses to journal sections by promptKey.
 * Returns a record keyed by promptKey, plus any orphaned responses from old formats.
 */
export function matchResponses(
  savedResponses: Array<{ prompt: string; promptKey?: string; response: string }>,
): { responses: Record<string, string>; orphaned: Array<{ prompt: string; response: string }> } {
  const knownKeys = new Set(JOURNAL_SECTIONS.map((s) => s.promptKey))
  const responses: Record<string, string> = {}
  const orphaned: Array<{ prompt: string; response: string }> = []

  for (const r of savedResponses) {
    if (r.promptKey && knownKeys.has(r.promptKey)) {
      responses[r.promptKey] = r.response
    } else if (r.response.trim()) {
      orphaned.push({ prompt: r.prompt, response: r.response })
    }
  }

  return { responses, orphaned }
}

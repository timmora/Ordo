// ---- Journal section definitions ----

export type SectionType = 'mood' | 'energy' | 'textarea'

export interface JournalSection {
  promptKey: string
  prompt: string
  type: SectionType
  placeholder?: string
}

// Prompt pools — one variant is selected per day via date-based seed
const WINS_PROMPTS: Pick<JournalSection, 'prompt' | 'placeholder'>[] = [
  { prompt: "What went well today? Any wins, progress, or things you're proud of?", placeholder: 'Even small wins count...' },
  { prompt: "What's one thing you accomplished today, big or small?", placeholder: 'Big or small, it counts...' },
  { prompt: 'Where did you show up well — for yourself or others — today?', placeholder: 'Moments of effort, care, or presence...' },
  { prompt: 'What made today feel worthwhile?', placeholder: 'A moment, an action, a conversation...' },
  { prompt: "What are you grateful for from today?", placeholder: 'People, moments, or small things...' },
  { prompt: 'What gave you energy or satisfaction today?', placeholder: 'Something that felt good or meaningful...' },
  { prompt: 'What progress did you make today, even if it felt small?', placeholder: 'Progress is progress...' },
]

const CHALLENGES_PROMPTS: Pick<JournalSection, 'prompt' | 'placeholder'>[] = [
  { prompt: 'What was difficult? What did you learn or want to do differently?', placeholder: 'Struggles, lessons, or things on your mind...' },
  { prompt: "What got in your way today? How did you respond?", placeholder: 'Obstacles, distractions, or friction...' },
  { prompt: "What's something you'd handle differently if you could redo today?", placeholder: 'No judgment — just reflection...' },
  { prompt: "What's weighing on your mind right now?", placeholder: 'Unfinished thoughts, worries, or tension...' },
  { prompt: "What drained you today? What would you like to let go of?", placeholder: 'Energy leaks or things to release...' },
  { prompt: 'Where did you feel stuck today? What might help next time?', placeholder: 'Patterns worth noticing...' },
  { prompt: 'What one lesson do you want to carry forward from today?', placeholder: 'Something worth remembering...' },
]

const INTENTION_PROMPTS: Pick<JournalSection, 'prompt' | 'placeholder'>[] = [
  { prompt: "What's your main intention or focus for tomorrow?", placeholder: 'One thing you want to focus on...' },
  { prompt: 'If tomorrow were a great day, what would make it that way?', placeholder: 'Paint the picture...' },
  { prompt: "What's one thing that would make tomorrow feel productive?", placeholder: 'The thing that would move the needle...' },
  { prompt: 'How do you want to feel at the end of tomorrow?', placeholder: 'Energised, calm, proud, present...' },
  { prompt: "What's something you want to do for yourself tomorrow?", placeholder: 'Rest, create, move, connect...' },
  { prompt: "What can you do tomorrow to move your biggest goal forward?", placeholder: 'One concrete step...' },
  { prompt: 'What habit or intention do you want to practise tomorrow?', placeholder: 'Small and specific works best...' },
]

/** Stable per-date seed (not cryptographic — just for deterministic daily selection). */
function dateSeed(date: string): number {
  let h = 0
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0
  return h
}

/** Returns journal sections with prompts chosen deterministically for the given date (YYYY-MM-DD). */
export function getDailyPrompts(date: string): JournalSection[] {
  const seed = Math.abs(dateSeed(date)); 

  const defaultPrompt = { 
    prompt: 'What is on your mind?', 
    placeholder: 'Write your thoughts here...' 
  };

  const getIndex = (val: number, arr: any[]) => arr.length > 0 ? val % arr.length : 0;

  const wins = WINS_PROMPTS[getIndex(seed, WINS_PROMPTS)] || defaultPrompt;
  const challenges = CHALLENGES_PROMPTS[getIndex(seed >>> 3, CHALLENGES_PROMPTS)] || defaultPrompt;
  const intention = INTENTION_PROMPTS[getIndex(seed >>> 6, INTENTION_PROMPTS)] || defaultPrompt;

  return [
    { promptKey: 'mood', prompt: 'Mood', type: 'mood' },
    { promptKey: 'energy', prompt: 'Energy', type: 'energy' },
    { promptKey: 'wins', prompt: wins?.prompt, type: 'textarea', placeholder: wins?.placeholder },
    { promptKey: 'challenges', prompt: challenges?.prompt, type: 'textarea', placeholder: challenges?.placeholder },
    { promptKey: 'intention', prompt: intention?.prompt, type: 'textarea', placeholder: intention?.placeholder },
  ];
}

// Static fallback — used for matching saved data (promptKeys only, prompt text irrelevant)
export const JOURNAL_SECTIONS: JournalSection[] = getDailyPrompts('2024-01-01')

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

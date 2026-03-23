import type { Task, Event, Course } from '@/types/database'

// ---- Generic prompt pool ----
const GENERIC_PROMPTS = [
  "What are the three most important things you want to accomplish today?",
  "What are you feeling grateful for right now?",
  "What's one challenge you're facing, and how might you approach it?",
  "What did you learn yesterday that you can apply today?",
  "What's one habit you want to build or strengthen this week?",
  "How are you feeling right now, physically and emotionally?",
  "What's one thing you've been putting off that you could do today?",
  "What's your biggest priority this week and why?",
  "Who in your life are you grateful for, and why?",
  "What's something you're looking forward to?",
  "What would make today feel like a success?",
  "What's one thing you can do to take care of yourself today?",
  "What's on your mind that you haven't had a chance to process?",
  "What's something you want to remember from the past week?",
  "If you could give your past self one piece of advice, what would it be?",
]

// ---- Contextual prompt generation ----
interface ContextualPrompt {
  key: string
  text: string
  priority: number
}

function offsetDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function generateContextualPrompts(
  dateStr: string,
  tasks: Task[],
  events: Event[],
  courseMap: Map<string, Course>,
): ContextualPrompt[] {
  const prompts: ContextualPrompt[] = []
  const yesterday = offsetDateStr(dateStr, -1)
  const tomorrow = offsetDateStr(dateStr, 1)

  for (const t of tasks) {
    const name = t.title
    const course = t.course_id ? courseMap.get(t.course_id) : null
    const label = course ? `${name} (${course.name})` : name

    // Overdue from yesterday
    if (t.due_date === yesterday && t.status !== 'done') {
      prompts.push({
        key: `ctx:task:${t.id}:overdue`,
        text: `"${label}" was due yesterday. What happened, and what's your plan?`,
        priority: 10,
      })
    }

    // Due today, not done
    if (t.due_date === dateStr && t.status !== 'done') {
      prompts.push({
        key: `ctx:task:${t.id}:due_today`,
        text: `"${label}" is due today. How are you feeling about it?`,
        priority: 8,
      })
    }

    // Completed today
    if (t.due_date === dateStr && t.status === 'done') {
      prompts.push({
        key: `ctx:task:${t.id}:completed`,
        text: `You completed "${label}". How did it go?`,
        priority: 2,
      })
    }

    // Due tomorrow
    if (t.due_date === tomorrow && t.status !== 'done') {
      prompts.push({
        key: `ctx:task:${t.id}:due_tomorrow`,
        text: `"${label}" is due tomorrow. What's your plan to get it done?`,
        priority: 4,
      })
    }
  }

  for (const e of events) {
    const eventDate = e.start_time.slice(0, 10)
    const name = e.title

    // Event today
    if (eventDate === dateStr) {
      prompts.push({
        key: `ctx:event:${e.id}:today`,
        text: `You have "${name}" today. How are you preparing?`,
        priority: 7,
      })
    }

    // Event yesterday
    if (eventDate === yesterday) {
      prompts.push({
        key: `ctx:event:${e.id}:yesterday`,
        text: `You had "${name}" yesterday. How did it go?`,
        priority: 5,
      })
    }
  }

  return prompts.sort((a, b) => b.priority - a.priority)
}

// ---- Public API ----

export interface PromptEntry {
  prompt: string
  promptKey?: string
}

/**
 * Returns 4 prompts for the given date:
 * - Up to 2 contextual (based on tasks/events)
 * - Fill to 4 with generic (deterministic by day-of-year)
 */
export function getPromptsForDate(
  dateStr: string,
  tasks: Task[],
  events: Event[],
  courses: Course[],
): PromptEntry[] {
  const courseMap = new Map(courses.map((c) => [c.id, c]))
  const contextual = generateContextualPrompts(dateStr, tasks, events, courseMap)

  // Take top 2 contextual
  const picked: PromptEntry[] = contextual.slice(0, 2).map((c) => ({
    prompt: c.text,
    promptKey: c.key,
  }))

  // Fill remaining slots with generic prompts
  const date = new Date(dateStr + 'T00:00:00')
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  )
  const needed = 4 - picked.length
  for (let i = 0; i < needed; i++) {
    const idx = (dayOfYear + i * 5) % GENERIC_PROMPTS.length
    picked.push({ prompt: GENERIC_PROMPTS[idx] })
  }

  return picked
}

/**
 * Match saved responses to current prompts.
 * Returns an array of response strings (one per prompt), plus any orphaned responses.
 */
export function matchResponses(
  prompts: PromptEntry[],
  savedResponses: Array<{ prompt: string; promptKey?: string; response: string }>,
): { responses: string[]; orphaned: Array<{ prompt: string; response: string }> } {
  const responses: string[] = []
  const matched = new Set<number>()

  for (const p of prompts) {
    let found = false
    for (let i = 0; i < savedResponses.length; i++) {
      if (matched.has(i)) continue
      const saved = savedResponses[i]
      // Match by promptKey first, then by exact prompt text
      if ((p.promptKey && saved.promptKey === p.promptKey) || saved.prompt === p.prompt) {
        responses.push(saved.response)
        matched.add(i)
        found = true
        break
      }
    }
    if (!found) responses.push('')
  }

  // Collect orphaned responses (non-empty, unmatched)
  const orphaned: Array<{ prompt: string; response: string }> = []
  for (let i = 0; i < savedResponses.length; i++) {
    if (!matched.has(i) && savedResponses[i].response.trim()) {
      orphaned.push({
        prompt: savedResponses[i].prompt,
        response: savedResponses[i].response,
      })
    }
  }

  return { responses, orphaned }
}

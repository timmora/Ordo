import { useEffect, useMemo, useRef, useState } from 'react'
import { useJournalEntry, useUpsertJournalEntry } from '@/hooks/useJournalEntries'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { JournalPromptResponse } from '@/types/database'

const PROMPTS = [
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

function getPromptsForDate(dateStr: string): string[] {
  // Deterministic: use the day-of-year as a seed to pick 3 prompts
  const date = new Date(dateStr + 'T00:00:00')
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  )
  const indices = [
    dayOfYear % PROMPTS.length,
    (dayOfYear + 5) % PROMPTS.length,
    (dayOfYear + 10) % PROMPTS.length,
  ]
  return indices.map((i) => PROMPTS[i])
}

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function offsetDate(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function JournalTab() {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayStr)

  const prompts = useMemo(() => getPromptsForDate(selectedDate), [selectedDate])

  const { data: entry } = useJournalEntry(selectedDate)
  const upsert = useUpsertJournalEntry()

  // Local state for textarea values
  const [responses, setResponses] = useState<string[]>(['', '', ''])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from DB whenever entry or date changes
  useEffect(() => {
    if (entry) {
      const mapped = prompts.map((p) => {
        const found = entry.responses.find((r: JournalPromptResponse) => r.prompt === p)
        return found ? found.response : ''
      })
      setResponses(mapped)
    } else {
      setResponses(['', '', ''])
    }
    setSaveStatus('idle')
  }, [entry, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(idx: number, value: string) {
    const next = [...responses]
    next[idx] = value
    setResponses(next)

    // Debounced auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(() => {
      const payload: JournalPromptResponse[] = prompts.map((p, i) => ({
        prompt: p,
        response: next[i],
      }))
      upsert.mutate(
        { date: selectedDate, responses: payload },
        { onSuccess: () => setSaveStatus('saved') }
      )
    }, 1000)
  }

  const isToday = selectedDate === todayStr
  const isFuture = selectedDate > todayStr

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedDate(offsetDate(selectedDate, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-semibold">{formatDisplayDate(selectedDate)}</h1>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs text-muted-foreground underline mt-0.5"
            >
              Back to today
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedDate(offsetDate(selectedDate, 1))}
          disabled={isToday}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Save status */}
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground">
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
        </span>
      </div>

      {isFuture ? (
        <p className="text-center text-muted-foreground text-sm py-12">
          No journal for future dates.
        </p>
      ) : (
        <div className="space-y-6">
          {prompts.map((prompt, idx) => (
            <div key={prompt} className="space-y-2">
              <p className="text-sm font-medium leading-snug">{prompt}</p>
              <textarea
                className="w-full min-h-[120px] rounded-md border bg-card px-3 py-2 text-sm resize-y placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Write your thoughts…"
                value={responses[idx]}
                onChange={(e) => handleChange(idx, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

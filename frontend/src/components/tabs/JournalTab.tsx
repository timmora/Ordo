import { useEffect, useMemo, useRef, useState } from 'react'
import { useJournalEntry, useUpsertJournalEntry } from '@/hooks/useJournalEntries'
import { useTasks } from '@/hooks/useTasks'
import { useEvents } from '@/hooks/useEvents'
import { useCourses } from '@/hooks/useCourses'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parse, format } from 'date-fns'
import { getPromptsForDate, matchResponses } from '@/lib/journalPrompts'
import type { JournalPromptResponse } from '@/types/database'

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

  const { data: tasks = [] } = useTasks()
  const { data: events = [] } = useEvents()
  const { data: courses = [] } = useCourses()

  const prompts = useMemo(
    () => getPromptsForDate(selectedDate, tasks, events, courses),
    [selectedDate, tasks, events, courses]
  )

  const { data: entry } = useJournalEntry(selectedDate)
  const upsert = useUpsertJournalEntry()

  // Local state for textarea values + orphaned responses
  const [responses, setResponses] = useState<string[]>(['', '', '', ''])
  const [orphaned, setOrphaned] = useState<Array<{ prompt: string; response: string }>>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel any pending save when date changes, BEFORE syncing new data
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setSaveStatus('idle')
  }, [selectedDate])

  // Sync from DB whenever entry or prompts change
  useEffect(() => {
    if (entry) {
      const result = matchResponses(prompts, entry.responses)
      setResponses(result.responses)
      setOrphaned(result.orphaned)
    } else {
      setResponses(prompts.map(() => ''))
      setOrphaned([])
    }
  }, [entry, prompts])

  // Refs to capture current values for the debounced save closure
  const dateRef = useRef(selectedDate)
  const promptsRef = useRef(prompts)
  const orphanedRef = useRef(orphaned)
  useEffect(() => { dateRef.current = selectedDate }, [selectedDate])
  useEffect(() => { promptsRef.current = prompts }, [prompts])
  useEffect(() => { orphanedRef.current = orphaned }, [orphaned])

  function handleChange(idx: number, value: string) {
    const next = [...responses]
    next[idx] = value
    setResponses(next)

    // Debounced auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(() => {
      const currentPrompts = promptsRef.current
      const currentDate = dateRef.current
      const currentOrphaned = orphanedRef.current
      const payload: JournalPromptResponse[] = currentPrompts.map((p, i) => ({
        prompt: p.prompt,
        promptKey: p.promptKey,
        response: next[i],
      }))
      // Preserve orphaned responses so they aren't lost
      for (const o of currentOrphaned) {
        payload.push({ prompt: o.prompt, response: o.response })
      }
      upsert.mutate(
        { date: currentDate, responses: payload },
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
        <div className="text-center relative">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="hover:text-muted-foreground transition-colors cursor-pointer">
                <h1 className="text-2xl font-bold">{formatDisplayDate(selectedDate)}</h1>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={parse(selectedDate, 'yyyy-MM-dd', new Date())}
                onSelect={(date) => {
                  if (date) setSelectedDate(format(date, 'yyyy-MM-dd'))
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="absolute top-full left-1/2 -translate-x-1/2 text-xs text-muted-foreground underline mt-0.5"
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
          {prompts.map((p, idx) => (
            <div key={p.promptKey ?? p.prompt} className="space-y-2">
              <p className="text-sm font-medium leading-snug">{p.prompt}</p>
              <textarea
                className="w-full min-h-[120px] rounded-md border bg-card px-3 py-2 text-sm resize-y placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Write your thoughts…"
                value={responses[idx]}
                onChange={(e) => handleChange(idx, e.target.value)}
              />
            </div>
          ))}

          {/* Orphaned responses from deleted tasks/events */}
          {orphaned.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">Previous responses</p>
              {orphaned.map((o, i) => (
                <div key={i} className="space-y-1 opacity-60">
                  <p className="text-sm font-medium leading-snug text-muted-foreground">{o.prompt}</p>
                  <p className="text-sm bg-muted/40 rounded-md px-3 py-2 whitespace-pre-wrap">{o.response}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useJournalEntry } from '@/hooks/useJournalEntries'
import { useTasks } from '@/hooks/useTasks'
import { useFocusSessions, useFocusStreak } from '@/hooks/useFocusSessions'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parse, format } from 'date-fns'
import { JOURNAL_SECTIONS, MOOD_OPTIONS, ENERGY_OPTIONS, matchResponses } from '@/lib/journalPrompts'
import { MoodEnergySelector } from '@/components/journal/MoodEnergySelector'
import { DayStatsBanner } from '@/components/journal/DayStatsBanner'
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildPayload(
  current: Record<string, string>,
  orphaned: Array<{ prompt: string; response: string }>,
): JournalPromptResponse[] | null {
  const hasContent = JOURNAL_SECTIONS.some((s) => (current[s.promptKey] ?? '').length > 0)
  if (!hasContent) return null
  const payload: JournalPromptResponse[] = JOURNAL_SECTIONS.map((s) => ({
    prompt: s.prompt,
    promptKey: s.promptKey,
    response: current[s.promptKey] ?? '',
  }))
  for (const o of orphaned) {
    payload.push({ prompt: o.prompt, response: o.response })
  }
  return payload
}

export function JournalTab() {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [selectedDate, setSelectedDate] = useState(todayStr)

  const { data: entry } = useJournalEntry(selectedDate)
  const queryClient = useQueryClient()

  // Stats for today's banner
  const isToday = selectedDate === todayStr
  const isFuture = selectedDate > todayStr
  const { data: tasks = [] } = useTasks()
  const { data: sessions = [] } = useFocusSessions(selectedDate)
  const { data: streak = 0 } = useFocusStreak()

  const focusSessions = sessions.filter((s) => s.mode === 'focus')
  const totalFocusMin = Math.round(focusSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60)
  const tasksTotal = tasks.filter((t) => t.due_date === selectedDate).length
  const tasksCompleted = tasks.filter((t) => t.due_date === selectedDate && t.status === 'done').length

  // Local state keyed by promptKey
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [orphaned, setOrphaned] = useState<Array<{ prompt: string; response: string }>>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Synchronous refs — always up-to-date, safe for closures & flush
  const responsesRef = useRef<Record<string, string>>({})
  const orphanedRef = useRef<Array<{ prompt: string; response: string }>>([])
  const dateRef = useRef(selectedDate)

  // Direct Supabase save — bypasses React Query mutation to avoid dropped calls
  async function save(date: string, data: Record<string, string>, orph: Array<{ prompt: string; response: string }>) {
    const payload = buildPayload(data, orph)
    if (!payload) return
    setSaveStatus('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveStatus('idle'); return }
    const { error } = await supabase
      .from('journal_entries')
      .upsert(
        { user_id: user.id, date, responses: payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      )
    if (error) {
      console.error('Journal save failed:', error)
      setSaveStatus('idle')
    } else {
      setSaveStatus('saved')
      queryClient.invalidateQueries({ queryKey: ['journal_entries', date] })
    }
  }

  // Flush pending debounce & clear state on date change
  useEffect(() => {
    // Flush any pending textarea debounce for the *previous* date
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      // Save whatever was pending for the old date
      save(dateRef.current, responsesRef.current, orphanedRef.current)
    }
    // Now update refs & clear state for the new date
    dateRef.current = selectedDate
    setSaveStatus('idle')
    setResponses({})
    setOrphaned([])
    responsesRef.current = {}
    orphanedRef.current = []
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync from DB whenever entry changes
  useEffect(() => {
    if (entry) {
      const result = matchResponses(entry.responses)
      setResponses(result.responses)
      setOrphaned(result.orphaned)
      responsesRef.current = result.responses
      orphanedRef.current = result.orphaned
    } else {
      setResponses({})
      setOrphaned([])
      responsesRef.current = {}
      orphanedRef.current = []
    }
  }, [entry])

  // Called by mood/energy selectors — saves immediately (no debounce)
  function handleSelectorChange(promptKey: string, value: string) {
    const next = { ...responsesRef.current, [promptKey]: value }
    responsesRef.current = next
    setResponses(next)
    save(dateRef.current, next, orphanedRef.current)
  }

  // Called by textareas — debounced 1s
  function handleTextChange(promptKey: string, value: string) {
    const next = { ...responsesRef.current, [promptKey]: value }
    responsesRef.current = next
    setResponses(next)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      save(dateRef.current, responsesRef.current, orphanedRef.current)
    }, 1000)
  }

  const textSections = JOURNAL_SECTIONS.filter((s) => s.type === 'textarea')

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
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && 'Saved'}
        </span>
      </div>

      {isFuture ? (
        <p className="text-center text-muted-foreground text-sm py-12">
          No journal for future dates.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Mood & Energy check-in */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Check-in</p>
            <MoodEnergySelector
              label="Mood"
              options={MOOD_OPTIONS}
              value={responses.mood ?? ''}
              onChange={(v) => handleSelectorChange('mood', v)}
            />
            <MoodEnergySelector
              label="Energy"
              options={ENERGY_OPTIONS}
              value={responses.energy ?? ''}
              onChange={(v) => handleSelectorChange('energy', v)}
            />
          </div>

          {/* Section 2: Day stats banner (today only) */}
          {isToday && (
            <DayStatsBanner
              focusMinutes={totalFocusMin}
              tasksCompleted={tasksCompleted}
              tasksTotal={tasksTotal}
              streak={streak}
            />
          )}

          {/* Sections 3-5: Textarea prompts */}
          {textSections.map((section) => (
            <div key={section.promptKey} className="space-y-2">
              <p className="text-sm font-medium leading-snug">{section.prompt}</p>
              <textarea
                className="w-full min-h-[120px] rounded-md border bg-card px-3 py-2 text-sm resize-y placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={section.placeholder}
                value={responses[section.promptKey] ?? ''}
                onChange={(e) => handleTextChange(section.promptKey, e.target.value)}
              />
            </div>
          ))}

          {/* Orphaned responses from old format entries */}
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

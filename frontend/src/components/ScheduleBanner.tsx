import { useState } from 'react'
import { useScheduleStore } from '@/store/scheduleStore'
import { CalendarCheck, ChevronDown, ChevronUp, X } from 'lucide-react'

export function ScheduleBanner() {
  const changes = useScheduleStore((s) => s.pendingChanges)
  const clearChanges = useScheduleStore((s) => s.clearChanges)
  const [expanded, setExpanded] = useState(false)

  if (!changes || changes.length === 0) return null

  const scheduled = changes.filter((c) => c.action === 'scheduled').length
  const moved = changes.filter((c) => c.action === 'moved').length

  const parts: string[] = []
  if (scheduled) parts.push(`${scheduled} scheduled`)
  if (moved) parts.push(`${moved} moved`)
  const summary = parts.join(', ')

  return (
    <div className="border-b bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <CalendarCheck className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-sm flex-1">
          <span className="font-medium">Schedule updated</span>
          <span className="text-muted-foreground"> — {summary}</span>
        </p>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={clearChanges}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="max-w-7xl mx-auto mt-2 space-y-1 pl-7">
          {changes.map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="font-medium text-foreground">{c.title}</span>
              <span>—</span>
              {c.action === 'scheduled' && c.new_start && (
                <span>
                  Scheduled for {new Date(c.new_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                  {new Date(c.new_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
              {c.action === 'moved' && c.new_start && (
                <span>
                  Moved to {new Date(c.new_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                  {new Date(c.new_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
              {c.action === 'unscheduled' && <span>Unscheduled</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

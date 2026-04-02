/**
 * Shared formatting and display utilities.
 *
 * Extracted from OverviewTab, EventsTab, TasksTab, and FocusTab
 * to eliminate duplication.
 */

import { parse, isValid } from 'date-fns'

const FLEXIBLE_DATE_FORMATS = ['MMM d, yyyy', 'MMMM d, yyyy', 'M/d/yyyy', 'MM/dd/yyyy', 'M/d/yy', 'yyyy-MM-dd', 'MMM d']

/** Try to parse a flexible date input string. Returns a Date or null. */
export function tryParseDate(input: string): Date | null {
  if (!input.trim()) return null
  const ref = new Date()
  for (const fmt of FLEXIBLE_DATE_FORMATS) {
    const d = parse(input.trim(), fmt, ref)
    if (isValid(d)) return d
  }
  return null
}

/** Format an ISO date string (YYYY-MM-DD) as "Wed, Mar 5". */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Return today's date as YYYY-MM-DD. */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Format an ISO datetime string as a short time, e.g. "2:30 PM". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Return a human-friendly relative label for a due date (e.g. "Today", "Tomorrow", "3 days ago"). */
export function relativeDueLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`
  return formatDate(dateStr)
}

/** Convert a 24-hour time string "HH:MM" to 12-hour am/pm format, e.g. "2:30 PM". */
export function formatTime24to12(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  let h = Number(hStr)
  const suffix = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr} ${suffix}`
}

/** Map task priority to a Badge variant. */
export function priorityVariant(p: 'low' | 'medium' | 'high') {
  if (p === 'high') return 'destructive' as const
  if (p === 'medium') return 'secondary' as const
  return 'outline' as const
}

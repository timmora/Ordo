import { useEffect } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useEvents } from '@/hooks/useEvents'

const REMINDER_LOG_KEY = 'ordo_reminder_log'

function loadReminderLog(): Record<string, true> {
  try {
    const raw = localStorage.getItem(REMINDER_LOG_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, true>
  } catch {
    return {}
  }
}

function saveReminderLog(log: Record<string, true>) {
  localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(log))
}

export function useReminderNotifications() {
  const { data: tasks = [] } = useTasks()
  const { data: events = [] } = useEvents()
  const hasAnyReminder = tasks.some((t) => t.reminder_enabled) || events.some((e) => e.reminder_enabled)

  useEffect(() => {
    if (!hasAnyReminder || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [hasAnyReminder])

  useEffect(() => {
    if (!('Notification' in window)) return

    const tick = () => {
      if (Notification.permission !== 'granted') return

      const now = Date.now()
      const log = loadReminderLog()
      let changed = false

      for (const task of tasks) {
        if (!task.reminder_enabled || !task.reminder_minutes_before || !task.due_date) continue
        const dueIso = `${task.due_date}T${task.due_time ?? '23:59'}:00`
        const dueMs = new Date(dueIso).getTime()
        const fireAtMs = dueMs - task.reminder_minutes_before * 60_000
        const key = `task:${task.id}:${dueIso}:${task.reminder_minutes_before}`
        if (now >= fireAtMs && now < dueMs + 60_000 && !log[key]) {
          new Notification('Task reminder', {
            body: `${task.title} is due soon.`,
          })
          log[key] = true
          changed = true
        }
      }

      for (const event of events) {
        if (!event.reminder_enabled || !event.reminder_minutes_before) continue
        const startMs = new Date(event.start_time).getTime()
        const fireAtMs = startMs - event.reminder_minutes_before * 60_000
        const key = `event:${event.id}:${event.start_time}:${event.reminder_minutes_before}`
        if (now >= fireAtMs && now < startMs + 60_000 && !log[key]) {
          new Notification('Event reminder', {
            body: `${event.title} starts soon.`,
          })
          log[key] = true
          changed = true
        }
      }

      if (changed) saveReminderLog(log)
    }

    tick()
    const interval = window.setInterval(tick, 30_000)
    return () => window.clearInterval(interval)
  }, [tasks, events])
}

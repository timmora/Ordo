import { useState, useEffect, useMemo } from 'react'
import { useScheduleStore } from '@/store/scheduleStore'
import { useAllSubtasks } from '@/hooks/useSubtasks'
import { useTasks } from '@/hooks/useTasks'
import { useCourses } from '@/hooks/useCourses'
import { CalendarCheck, ChevronDown, ChevronUp, X } from 'lucide-react'

export function ScheduleBanner() {
  const changes = useScheduleStore((s) => s.pendingChanges)
  const clearChanges = useScheduleStore((s) => s.clearChanges)
  const [expanded, setExpanded] = useState(false)

  // Lookup data for course grouping (already cached in React Query — no extra requests)
  const { data: allSubtasksMap } = useAllSubtasks()
  const { data: tasks = [] } = useTasks()
  const { data: courses = [] } = useCourses()

  // Auto-dismiss after 7 seconds
  useEffect(() => {
    if (!changes || changes.length === 0) return
    setExpanded(false)
    const timer = setTimeout(clearChanges, 7000)
    return () => clearTimeout(timer)
  }, [changes]) // eslint-disable-line react-hooks/exhaustive-deps

  // subtask_id → course_id (via task)
  const subtaskCourseMap = useMemo(() => {
    const taskMap = new Map(tasks.map((t) => [t.id, t.course_id]))
    const m = new Map<string, string | null>()
    allSubtasksMap?.forEach((subs, taskId) => {
      const courseId = taskMap.get(taskId) ?? null
      subs.forEach((s) => m.set(s.id, courseId))
    })
    return m
  }, [allSubtasksMap, tasks])

  const courseNameMap = useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses])

  // Group changes: { label → count } where label = "action|courseName"
  const groups = useMemo(() => {
    if (!changes) return []
    const m = new Map<string, { count: number; action: string; courseName: string | null }>()
    for (const c of changes) {
      const courseId = subtaskCourseMap.get(c.subtask_id) ?? null
      const courseName = courseId ? (courseNameMap.get(courseId) ?? null) : null
      const key = `${c.action}|${courseName ?? ''}`
      const existing = m.get(key)
      if (existing) existing.count++
      else m.set(key, { count: 1, action: c.action, courseName })
    }
    return Array.from(m.values())
  }, [changes, subtaskCourseMap, courseNameMap])

  if (!changes || changes.length === 0) return null

  const totalCount = changes.length

  return (
    <div className="border-b bg-accent/60 border-border px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <CalendarCheck className="size-4 text-foreground/70 shrink-0" />
        <p className="text-sm flex-1">
          <span className="font-medium">Schedule updated</span>
          <span className="text-muted-foreground"> — {totalCount} subtask{totalCount !== 1 ? 's' : ''} rescheduled</span>
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
          {groups.map((g, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {g.count} subtask{g.count !== 1 ? 's' : ''} {g.action}
              </span>
              {g.courseName && <span> for {g.courseName}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

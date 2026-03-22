import { useMemo, useState } from 'react'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useEvents } from '@/hooks/useEvents'
import { useCourses } from '@/hooks/useCourses'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { LiveClock } from '@/components/LiveClock'
import { Badge } from '@/components/ui/badge'
import { useTasksWithSubtasks } from '@/hooks/useSubtasks'
import { Sparkles } from 'lucide-react'
import type { Task } from '@/types/database'

type OverviewView = 'today' | 'upcoming'

interface Props {
  onTaskClick: (task: Task) => void
  onDecompose?: (task: Task) => void
}

const today = () => new Date().toISOString().slice(0, 10)

function priorityVariant(p: Task['priority']) {
  if (p === 'high') return 'destructive'
  if (p === 'medium') return 'secondary'
  return 'outline'
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function OverviewTab({ onTaskClick, onDecompose }: Props) {
  const [view, setView] = useState<OverviewView>('today')
  const { data: tasks = [] } = useTasks()
  const { data: events = [] } = useEvents()
  const { data: courses = [] } = useCourses()
  const todayStr = today()
  const { data: focusSessions = [] } = useFocusSessions(todayStr)
  const { data: decomposedTaskIds } = useTasksWithSubtasks()
  const updateTask = useUpdateTask()

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses]
  )

  const todayEvents = useMemo(() => {
    return events
      .filter((e) => e.start_time.slice(0, 10) === todayStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [events, todayStr])

  const todayTasks = useMemo(() => {
    return tasks.filter((t) => t.due_date === todayStr)
  }, [tasks, todayStr])

  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.start_time.slice(0, 10) > todayStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [events, todayStr])

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.due_date > todayStr && t.status !== 'done')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [tasks, todayStr])

  const doneTasks = todayTasks.filter((t) => t.status === 'done')
  const progressPct =
    todayTasks.length > 0 ? Math.round((doneTasks.length / todayTasks.length) * 100) : 0

  const totalFocusMinutes = useMemo(() => {
    return Math.round(
      focusSessions
        .filter((s) => s.mode === 'focus')
        .reduce((sum, s) => sum + s.duration_seconds, 0) / 60
    )
  }, [focusSessions])

  function toggleTask(task: Task) {
    updateTask.mutate({
      id: task.id,
      status: task.status === 'done' ? 'todo' : 'done',
    })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Clock + date */}
      <div>
        <h1 className="text-2xl font-semibold mb-1">Good day</h1>
        <LiveClock />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Tasks today</p>
          <p className="text-2xl font-semibold">{doneTasks.length}/{todayTasks.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Events today</p>
          <p className="text-2xl font-semibold">{todayEvents.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Focus minutes</p>
          <p className="text-2xl font-semibold">{totalFocusMinutes}</p>
        </div>
      </div>

      {/* Task progress bar */}
      {todayTasks.length > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Task progress</span>
            <span className="font-medium">{progressPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Today / Upcoming toggle */}
      <div className="flex gap-1 border-b">
        {(['today', 'upcoming'] as OverviewView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              view === v
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'today' ? 'Today' : 'Upcoming'}
          </button>
        ))}
      </div>

      {view === 'today' && (
        <>
          {/* Today's events */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Events
            </h2>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No events today.</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((event) => {
                  const course = event.course_id ? courseMap[event.course_id] : null
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 px-3 py-2.5"
                    >
                      {course && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: course.color }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        {course && (
                          <p className="text-xs text-muted-foreground">{course.name}</p>
                        )}
                      </div>
                      {!event.all_day && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {formatTime(event.start_time)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Today's tasks */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Tasks
            </h2>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No tasks due today.</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => {
                  const course = task.course_id ? courseMap[task.course_id] : null
                  const done = task.status === 'done'
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTask(task)}
                        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                          done
                            ? 'bg-green-500 border-green-500'
                            : 'border-muted-foreground hover:border-green-500'
                        }`}
                      >
                        {done && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${done ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </p>
                        {course && (
                          <p className="text-xs text-muted-foreground">{course.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={priorityVariant(task.priority)} className="text-xs">
                          {task.priority}
                        </Badge>
                        {onDecompose && !done && !decomposedTaskIds?.has(task.id) && (
                          <button
                            type="button"
                            onClick={() => onDecompose(task)}
                            className="p-1 text-muted-foreground hover:text-amber-500 transition-colors"
                            title="Break it down"
                          >
                            <Sparkles className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onTaskClick(task)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'upcoming' && (
        <>
          {/* Upcoming events */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Events
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No upcoming events.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => {
                  const course = event.course_id ? courseMap[event.course_id] : null
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 px-3 py-2.5"
                    >
                      {course && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: course.color }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        {course && (
                          <p className="text-xs text-muted-foreground">{course.name}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(event.start_time.slice(0, 10))}
                        {!event.all_day && ` ${formatTime(event.start_time)}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming tasks */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Tasks
            </h2>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No upcoming tasks.</p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((task) => {
                  const course = task.course_id ? courseMap[task.course_id] : null
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {course && (
                          <p className="text-xs text-muted-foreground">{course.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(task.due_date)}
                        </span>
                        <Badge variant={priorityVariant(task.priority)} className="text-xs">
                          {task.priority}
                        </Badge>
                        {onDecompose && !decomposedTaskIds?.has(task.id) && (
                          <button
                            type="button"
                            onClick={() => onDecompose(task)}
                            className="p-1 text-muted-foreground hover:text-amber-500 transition-colors"
                            title="Break it down"
                          >
                            <Sparkles className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onTaskClick(task)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

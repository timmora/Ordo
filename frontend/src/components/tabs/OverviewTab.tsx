import { useMemo, useState } from 'react'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useEvents } from '@/hooks/useEvents'
import { useCourses } from '@/hooks/useCourses'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { useOverviewSummary } from '@/hooks/useOverviewSummary'
import { LiveClock } from '@/components/LiveClock'
import { Badge } from '@/components/ui/badge'
import { useTasksWithSubtasks, useAllSubtasks } from '@/hooks/useSubtasks'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useSchedule } from '@/hooks/useSchedule'
import { Sparkles, RefreshCw, CalendarSync } from 'lucide-react'
import { OverviewTabSkeleton } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, todayStr, formatTime, priorityVariant } from '@/lib/dateUtils'
import type { DecomposeContext } from '@/components/tasks/TaskModal'
import type { Task } from '@/types/database'

const QUOTES = [
  'In the middle of difficulty lies opportunity.',
  'One must imagine Sisyphus happy.',
  'The only way to do great work is to love what you do.',
  'Your body is not a temple, it\'s an amusement park. Enjoy the ride.',
  'The struggle itself toward the heights is enough to fill a man\'s heart.',
  'Skills can be taught. Character you either have or you don\'t have.',
  'Live as if you were to die tomorrow. Learn as if you were to live forever.',
  'It is not the strongest of the species that survives, nor the most intelligent, but the one most responsive to change.',
  'The unexamined life is not worth living.',
  'I have no special talents. I am only passionately curious.',
  'Without work, all life goes rotten.',
  'If I am not for myself, who will be for me? If I am only for myself, what am I? And if not now, when?',
  'We suffer more often in imagination than in reality.',
  'No one can make you feel inferior without your consent.',
  'The impediment to action advances action. What stands in the way becomes the way.',
  'Open your mouth only if what you are going to say is more beautiful than silence.',
  'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.',
  'Travel changes you. As you move through this life and this world you change things slightly, you leave marks behind, however small.',
  'He who has a why to live for can bear almost any how.',
  'You must be the change you wish to see in the world.',
]

const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)]

type OverviewView = 'today' | 'upcoming'

interface Props {
  onTaskClick: (task: Task) => void
  onDecompose?: (ctx: DecomposeContext) => void
  onNavigate?: (tab: string) => void
  onNewEvent?: () => void
  onNewTask?: () => void
}

export function OverviewTab({ onTaskClick, onDecompose, onNavigate, onNewEvent, onNewTask }: Props) {
  const [view, setView] = useState<OverviewView>('today')
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: events = [], isLoading: eventsLoading } = useEvents()
  const { data: courses = [] } = useCourses()
  const todayDate = todayStr()
  const { data: focusSessions = [] } = useFocusSessions(todayDate)
  const { data: decomposedTaskIds } = useTasksWithSubtasks()
  const updateTask = useUpdateTask()
  const { data: aiSummary, isFetching: summaryBusy, error: summaryError, regenerateSummary } = useOverviewSummary()
  const { data: allSubtasksMap } = useAllSubtasks()
  const { data: userSettings } = useUserSettings()
  const schedule = useSchedule()

  const todayCapacity = useMemo(() => {
    const cap = userSettings?.daily_capacity_hours ?? 6
    const allSubtasks = Array.from(allSubtasksMap?.values() ?? []).flat()
    const scheduledToday = allSubtasks.filter((s) => {
      if (!s.scheduled_start || s.status === 'complete') return false
      return s.scheduled_start.slice(0, 10) === todayDate
    })
    const usedMinutes = scheduledToday.reduce((sum, s) => sum + s.estimated_minutes, 0)
    return { used: Math.round(usedMinutes / 6) / 10, cap }
  }, [allSubtasksMap, userSettings, todayDate])

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses]
  )

  const todayEvents = useMemo(() => {
    return events
      .filter((e) => e.start_time.slice(0, 10) === todayDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [events, todayDate])

  function isEventPast(event: { start_time: string; end_time: string | null; all_day: boolean }) {
    if (event.all_day) return false
    const now = new Date()
    const compare = event.end_time ? new Date(event.end_time) : new Date(event.start_time)
    return compare < now
  }

  const todayTasks = useMemo(() => {
    return tasks
      .filter((t) => t.due_date === todayDate)
      .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
  }, [tasks, todayDate])

  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.start_time.slice(0, 10) > todayDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [events, todayDate])

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.due_date > todayDate && t.status !== 'done')
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
  }, [tasks, todayDate])

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

  if (tasksLoading || eventsLoading) return <OverviewTabSkeleton />

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      {/* Clock + date */}
      <div>
        <h1 className="text-2xl font-normal italic mb-1">"{quote}"</h1>
        <LiveClock />
      </div>

      {/* AI Summary */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            Daily Briefing
          </div>
          <button
            type="button"
            onClick={() => regenerateSummary()}
            disabled={summaryBusy}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh summary"
          >
            <RefreshCw className={`size-3.5 ${summaryBusy ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {summaryBusy && (
          <div className="space-y-2 py-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-1/2 mt-1" />
          </div>
        )}
        {!summaryBusy && summaryError && !aiSummary && (
          <div className="flex items-center justify-between py-1">
            <p className="text-sm text-destructive">Could not load briefing.</p>
            <button
              type="button"
              onClick={() => regenerateSummary()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="size-3" />
              Retry
            </button>
          </div>
        )}
        {aiSummary && !summaryBusy && (
          <>
            <p className="text-sm">{aiSummary.summary}</p>
            <p className="text-sm text-muted-foreground italic">{aiSummary.tip}</p>
          </>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Tasks today</p>
          <p className="text-2xl font-semibold">{todayTasks.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Events today</p>
          <p className="text-2xl font-semibold">{todayEvents.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Focus minutes</p>
          <p className="text-2xl font-semibold">{totalFocusMinutes}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Capacity</p>
            <button
              type="button"
              onClick={() => schedule.mutate({ force: true })}
              disabled={schedule.isPending}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Reschedule"
            >
              <CalendarSync className={`size-3 ${schedule.isPending ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-2xl font-semibold">{todayCapacity.used}<span className="text-sm font-normal text-muted-foreground">/{todayCapacity.cap}h</span></p>
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
              className="h-full bg-green-500 dark:bg-emerald-400 rounded-full transition-all"
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Events</h2>
              {onNavigate && <button type="button" onClick={() => onNavigate('events')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Go to events</button>}
            </div>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No events today.{onNewEvent && <>{' '}<button type="button" onClick={onNewEvent} className="underline underline-offset-2 hover:text-foreground transition-colors">Add one</button></>}
              </p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((event) => {
                  const course = event.course_id ? courseMap[event.course_id] : null
                  const past = isEventPast(event)
                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/40 transition-colors ${
                        past ? 'bg-muted/40 border-muted opacity-60' : 'bg-card'
                      }`}
                    >
                      {course && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: course.color }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${past ? 'line-through text-muted-foreground' : ''}`}>{event.title}</p>
                        {course && (
                          <p className="text-xs text-muted-foreground">{course.name}</p>
                        )}
                      </div>
                      {!event.all_day && (
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {formatTime(event.start_time)}
                          {past && ' · Done'}
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tasks</h2>
              {onNavigate && <button type="button" onClick={() => onNavigate('tasks')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Go to tasks</button>}
            </div>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No tasks due today.{onNewTask && <>{' '}<button type="button" onClick={onNewTask} className="underline underline-offset-2 hover:text-foreground transition-colors">Add one</button></>}
              </p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => {
                  const course = task.course_id ? courseMap[task.course_id] : null
                  const done = task.status === 'done'
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`Mark "${task.title}" as ${done ? 'incomplete' : 'complete'}`}
                        onClick={() => toggleTask(task)}
                        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
                          done
                            ? 'bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500'
                            : 'border-muted-foreground hover:border-green-500 dark:hover:border-emerald-400'
                        }`}
                      >
                        {done && (
                          <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
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
                            onClick={() => onDecompose({ task })}
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Events</h2>
              {onNavigate && <button type="button" onClick={() => onNavigate('events')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Go to events</button>}
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No upcoming events.{onNewEvent && <>{' '}<button type="button" onClick={onNewEvent} className="underline underline-offset-2 hover:text-foreground transition-colors">Add one</button></>}
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => {
                  const course = event.course_id ? courseMap[event.course_id] : null
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tasks</h2>
              {onNavigate && <button type="button" onClick={() => onNavigate('tasks')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Go to tasks</button>}
            </div>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No upcoming tasks.{onNewTask && <>{' '}<button type="button" onClick={onNewTask} className="underline underline-offset-2 hover:text-foreground transition-colors">Add one</button></>}
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((task) => {
                  const course = task.course_id ? courseMap[task.course_id] : null
                  const done = task.status === 'done'
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`Mark "${task.title}" as ${done ? 'incomplete' : 'complete'}`}
                        onClick={() => toggleTask(task)}
                        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
                          done
                            ? 'bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500'
                            : 'border-muted-foreground hover:border-green-500 dark:hover:border-emerald-400'
                        }`}
                      >
                        {done && (
                          <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate transition-all duration-300 ${done ? 'line-through text-muted-foreground opacity-60' : ''}`}>{task.title}</p>
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
                            onClick={() => onDecompose({ task })}
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

import { useMemo, useState } from 'react'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useCourses } from '@/hooks/useCourses'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon, ChevronRight, ListPlus, Sparkles } from 'lucide-react'
import { useTasksWithSubtasks, useAllSubtasks, useUpdateSubtask } from '@/hooks/useSubtasks'
import type { DecomposeContext } from '@/components/tasks/TaskModal'
import type { Task } from '@/types/database'

type FilterTab = 'all' | 'overdue' | 'this_week' | 'later'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'

interface Props {
  onTaskClick: (task: Task) => void
  onNewTask: () => void
  onDecompose?: (ctx: DecomposeContext) => void
}

function priorityVariant(p: Task['priority']) {
  if (p === 'high') return 'destructive'
  if (p === 'medium') return 'secondary'
  return 'outline'
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const weekStr = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export function TasksTab({ onTaskClick, onNewTask, onDecompose }: Props) {
  const { data: tasks = [] } = useTasks()
  const { data: courses = [] } = useCourses()
  const { data: decomposedTaskIds } = useTasksWithSubtasks()
  const { data: subtasksMap } = useAllSubtasks()
  const updateTask = useUpdateTask()
  const updateSubtask = useUpdateSubtask()

  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses]
  )

  const filtered = useMemo(() => {
    const today = todayStr()
    const week = weekStr()

    const result = tasks.filter((t) => {
      // Status tab filter
      if (filterTab === 'overdue' && (t.due_date >= today || t.status === 'done')) return false
      if (filterTab === 'this_week' && (t.due_date < today || t.due_date > week)) return false
      if (filterTab === 'later' && t.due_date <= week) return false
      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      // Course filter
      if (courseFilter !== 'all' && t.course_id !== courseFilter) return false
      return true
    })

    // Done tasks sink to the bottom
    result.sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0
      const bDone = b.status === 'done' ? 1 : 0
      return aDone - bDone
    })

    return result
  }, [tasks, filterTab, priorityFilter, courseFilter])

  function toggleTask(task: Task) {
    updateTask.mutate({
      id: task.id,
      status: task.status === 'done' ? 'todo' : 'done',
    })
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'this_week', label: 'This Week' },
    { id: 'later', label: 'Later' },
  ]

  return (
    <div className="space-y-4 py-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Button size="sm" onClick={onNewTask}>
          <ListPlus className="size-4 mr-1.5" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tab filter */}
        <div className="flex rounded-md border overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filterTab === tab.id
                  ? 'bg-foreground text-background'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-36 justify-between font-normal text-sm">
              {{ all: 'All priorities', high: 'High', medium: 'Medium', low: 'Low' }[priorityFilter]}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              {priorityFilter !== 'all' && <DropdownMenuItem onSelect={() => setPriorityFilter('all')}>All priorities</DropdownMenuItem>}
              {priorityFilter !== 'high' && <DropdownMenuItem onSelect={() => setPriorityFilter('high')}>High</DropdownMenuItem>}
              {priorityFilter !== 'medium' && <DropdownMenuItem onSelect={() => setPriorityFilter('medium')}>Medium</DropdownMenuItem>}
              {priorityFilter !== 'low' && <DropdownMenuItem onSelect={() => setPriorityFilter('low')}>Low</DropdownMenuItem>}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Course filter */}
        {courses.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-40 justify-between font-normal text-sm">
                {courseFilter === 'all' ? 'All courses' : courses.find((c) => c.id === courseFilter)?.name ?? 'All courses'}
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                {courseFilter !== 'all' && <DropdownMenuItem onSelect={() => setCourseFilter('all')}>All courses</DropdownMenuItem>}
                {courses.filter((c) => c.id !== courseFilter).map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => setCourseFilter(c.id)}>{c.name}</DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No tasks match your filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const course = task.course_id ? courseMap[task.course_id] : null
            const done = task.status === 'done'
            const today = todayStr()
            const overdue = task.due_date < today && !done

            const taskSubtasks = subtasksMap?.get(task.id) ?? []
            const hasSubtasks = taskSubtasks.length > 0
            const expanded = expandedTaskId === task.id

            return (
              <div key={task.id}>
                <div
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => {
                    if (hasSubtasks) setExpandedTaskId(expanded ? null : task.id)
                  }}
                >
                  {/* Expand chevron / checkbox */}
                  {hasSubtasks ? (
                    <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleTask(task) }}
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

                  {/* Course color dot */}
                  {course && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: course.color }}
                    />
                  )}

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${done ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {course && (
                        <span className="text-xs text-muted-foreground">{course.name}</span>
                      )}
                      {task.estimated_hours && (
                        <span className="text-xs text-muted-foreground">{course ? '· ' : ''}{task.estimated_hours}h</span>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-mono ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {task.due_date}{task.due_time ? ` ${task.due_time}` : ''}
                    </span>
                    <Badge variant={priorityVariant(task.priority)} className="text-xs">
                      {task.priority}
                    </Badge>
                    {onDecompose && !done && !decomposedTaskIds?.has(task.id) && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDecompose({ task }) }}
                        className="p-1 text-muted-foreground hover:text-amber-500 transition-colors"
                        title="Break it down"
                      >
                        <Sparkles className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task) }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Subtasks — revealed on expand */}
                {hasSubtasks && expanded && (
                  <div className="ml-10 border-l pl-3 space-y-1 py-1">
                    {taskSubtasks.map((sub, i) => {
                      const subDone = sub.status === 'complete'
                      const unlocked = subDone || taskSubtasks.slice(0, i).every((prev) => prev.status === 'complete')
                      return (
                        <div
                          key={sub.id}
                          className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${unlocked ? 'hover:bg-muted/40' : 'opacity-50'}`}
                        >
                          <button
                            type="button"
                            disabled={!unlocked}
                            onClick={() => {
                              const newStatus = subDone ? 'pending' : 'complete'
                              updateSubtask.mutate({ id: sub.id, status: newStatus })
                              if (newStatus === 'complete') {
                                const allOthersDone = taskSubtasks.every((s) => s.id === sub.id || s.status === 'complete')
                                if (allOthersDone && task.status !== 'done') {
                                  updateTask.mutate({ id: task.id, status: 'done' })
                                }
                              }
                            }}
                            className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                              subDone
                                ? 'bg-green-500 border-green-500'
                                : unlocked
                                  ? 'border-muted-foreground/60 hover:border-green-500'
                                  : 'border-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            {subDone && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <span className={`text-xs flex-1 min-w-0 truncate ${subDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {sub.title}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {sub.estimated_minutes}m
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

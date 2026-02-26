import { useMemo, useState } from 'react'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useCourses } from '@/hooks/useCourses'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListPlus } from 'lucide-react'
import type { Task } from '@/types/database'

type FilterTab = 'all' | 'overdue' | 'this_week' | 'later'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'

interface Props {
  onTaskClick: (task: Task) => void
  onNewTask: () => void
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

export function TasksTab({ onTaskClick, onNewTask }: Props) {
  const { data: tasks = [] } = useTasks()
  const { data: courses = [] } = useCourses()
  const updateTask = useUpdateTask()

  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses]
  )

  const filtered = useMemo(() => {
    const today = todayStr()
    const week = weekStr()

    return tasks.filter((t) => {
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
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
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
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Course filter */}
        {courses.length > 0 && (
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

            return (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
              >
                {/* Checkbox */}
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
                      <span className="text-xs text-muted-foreground">· {task.estimated_hours}h</span>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-mono ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {task.due_date}
                  </span>
                  <Badge variant={priorityVariant(task.priority)} className="text-xs">
                    {task.priority}
                  </Badge>
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
  )
}

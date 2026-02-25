import { useState } from 'react'
import { isAfter, isBefore, startOfDay, endOfDay, addDays, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { useTasks } from '@/hooks/useTasks'
import { useCourses } from '@/hooks/useCourses'
import { TaskModal } from './TaskModal'
import type { Task } from '@/types/database'

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
}

export function TaskSidebar() {
  const { data: tasks = [] } = useTasks()
  const { data: courses = [] } = useCourses()
  const [selected, setSelected] = useState<Task | undefined>()
  const [modalOpen, setModalOpen] = useState(false)

  const courseMap = new Map(courses.map((c) => [c.id, c]))
  const now = new Date()
  const today = startOfDay(now)
  const weekEnd = endOfDay(addDays(today, 7))

  const pending = tasks.filter((t) => t.status !== 'done')
  const overdue = pending.filter((t) => isBefore(parseISO(t.due_date), today))
  const thisWeek = pending.filter((t) => {
    const d = parseISO(t.due_date)
    return !isBefore(d, today) && !isAfter(d, weekEnd)
  })
  const later = pending.filter((t) => isAfter(parseISO(t.due_date), weekEnd))

  function openEdit(task: Task) {
    setSelected(task)
    setModalOpen(true)
  }

  function TaskCard({ task }: { task: Task }) {
    const course = task.course_id ? courseMap.get(task.course_id) : undefined
    return (
      <button
        className="w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors"
        onClick={() => openEdit(task)}
      >
        <div className="flex items-start gap-2">
          <span
            className="size-2 rounded-full shrink-0 mt-1.5"
            style={{ backgroundColor: course?.color ?? '#94a3b8' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{task.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {course && (
                <span className="text-xs text-muted-foreground truncate">{course.name}</span>
              )}
              <Badge className={`text-xs px-1 py-0 ${PRIORITY_COLOR[task.priority]}`}>
                {task.priority}
              </Badge>
            </div>
          </div>
        </div>
      </button>
    )
  }

  function Section({ label, tasks }: { label: string; tasks: Task[] }) {
    if (tasks.length === 0) return null
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
          {label}
        </p>
        <div className="space-y-0.5">
          {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tasks
          </span>
        </div>

        {pending.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">No pending tasks.</p>
        )}

        <Section label="Overdue" tasks={overdue} />
        <Section label="This week" tasks={thisWeek} />
        <Section label="Later" tasks={later} />
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={selected}
      />
    </>
  )
}

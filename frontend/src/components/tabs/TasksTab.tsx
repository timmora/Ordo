import { useMemo, useState } from 'react'
import { useTasks, useUpdateTask, useBulkUpdateTasks } from '@/hooks/useTasks'
import { useCourses } from '@/hooks/useCourses'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon, ChevronRight, ListPlus, CheckSquare, Sparkles, Trash2, CheckCircle, X } from 'lucide-react'
import { useTasksWithSubtasks, useAllSubtasks, useUpdateSubtask, useReorderSubtasks } from '@/hooks/useSubtasks'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { todayStr, priorityVariant, relativeDueLabel, formatTime24to12 } from '@/lib/dateUtils'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { undoableDelete } from '@/lib/undoableDelete'
import { toast } from 'sonner'
import type { DecomposeContext } from '@/components/tasks/TaskModal'
import { SubtaskModal } from '@/components/tasks/SubtaskModal'
import { ListTabSkeleton } from '@/components/skeletons'
import type { Task, Subtask } from '@/types/database'

const restrictToVerticalWithinContainer: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 }
  return {
    ...transform,
    x: 0,
    y: Math.min(Math.max(transform.y, containerNodeRect.top - draggingNodeRect.top), containerNodeRect.bottom - draggingNodeRect.bottom),
  }
}

type FilterTab = 'all' | 'overdue' | 'this_week' | 'later'
type PriorityFilter = 'all' | 'high' | 'medium' | 'low'

interface Props {
  onTaskClick: (task: Task) => void
  onNewTask: () => void
  onDecompose?: (ctx: DecomposeContext) => void
}

const weekStr = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function SortableSubtaskRow({ sub, unlocked, onToggle, onEdit }: {
  sub: Subtask
  index: number
  allSubs: Subtask[]
  unlocked: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id })
  const subDone = sub.status === 'complete'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined }}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors group ${unlocked ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-50'}`}
      onClick={() => { if (unlocked) onEdit() }}
    >
      <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder"
        className="cursor-grab text-muted-foreground/20 group-hover:text-muted-foreground/60 hover:text-muted-foreground touch-none transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={subDone}
        aria-label={`Mark subtask "${sub.title}" as ${subDone ? 'incomplete' : 'complete'}`}
        disabled={!unlocked}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
          subDone
            ? 'bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500'
            : 'border-muted-foreground hover:border-green-500 dark:hover:border-emerald-400'
        }`}
      >
        {subDone && (
          <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </button>
      <span className={`text-xs flex-1 min-w-0 truncate ${subDone ? 'line-through text-muted-foreground' : ''}`}>
        {sub.title}
      </span>
      <span className="text-xs text-muted-foreground shrink-0">
        {sub.estimated_minutes}m
      </span>
    </div>
  )
}

export function TasksTab({ onTaskClick, onNewTask, onDecompose }: Props) {
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: courses = [], isLoading: coursesLoading } = useCourses()
  const { data: decomposedTaskIds } = useTasksWithSubtasks()
  const { data: subtasksMap } = useAllSubtasks()
  const queryClient = useQueryClient()
  const updateTask = useUpdateTask()
  const updateSubtask = useUpdateSubtask()
  const bulkUpdate = useBulkUpdateTasks()
  const reorderSubtasks = useReorderSubtasks()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleSubtaskDragEnd(taskId: string, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const subs = subtasksMap?.get(taskId) ?? []
    const oldIndex = subs.findIndex((s) => s.id === active.id)
    const newIndex = subs.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(subs, oldIndex, newIndex)
    // Optimistically update the cache
    if (subtasksMap) {
      const next = new Map(subtasksMap)
      next.set(taskId, reordered)
      // We don't setQueryData here directly — the mutation's onSettled will refetch
    }
    reorderSubtasks.mutate(reordered.map((s, i) => ({ id: s.id, order_index: i })))
  }

  const [subtaskEditTarget, setSubtaskEditTarget] = useState<Subtask | null>(null)

  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false) }

  const bulkMarkDone = () => {
    const count = selectedIds.size
    bulkUpdate.mutate({ ids: [...selectedIds], patch: { status: 'done' } })
    clearSelection()
    toast.success(`${count} task${count > 1 ? 's' : ''} marked done`)
  }
  const bulkSetPriority = (p: 'high' | 'medium' | 'low') => {
    const count = selectedIds.size
    bulkUpdate.mutate({ ids: [...selectedIds], patch: { priority: p } })
    clearSelection()
    toast.success(`${count} task${count > 1 ? 's' : ''} set to ${p} priority`)
  }
  const bulkDeleteSelected = () => {
    const ids = [...selectedIds]
    const items = tasks.filter((t) => selectedIds.has(t.id))
    clearSelection()
    undoableDelete({
      queryClient,
      queryKey: ['tasks'],
      items,
      deleteFn: async () => {
        const { error } = await supabase.from('tasks').delete().in('id', ids)
        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ['subtasks'] })
      },
      message: `${ids.length} task${ids.length > 1 ? 's' : ''} deleted`,
    })
  }

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
    { id: 'this_week', label: 'This Week' },
    { id: 'later', label: 'Later' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'all', label: 'All' },
  ]

  if (tasksLoading || coursesLoading) return <ListTabSkeleton />

  return (
    <div className="space-y-4 py-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={selectMode ? 'secondary' : 'outline'}
            onClick={() => { if (selectMode) clearSelection(); else setSelectMode(true) }}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </Button>
          <Button size="sm" onClick={onNewTask}>
            <ListPlus className="size-4 mr-1.5" />
            New Task
          </Button>
        </div>
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

      {/* Bulk action bar — visible in select mode when items are selected */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
          <span className="text-sm font-medium mr-1">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={bulkMarkDone}>
            <CheckCircle className="size-3.5 mr-1" /> Done
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Priority <ChevronDownIcon className="size-3.5 ml-1" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => bulkSetPriority('high')}>High</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => bulkSetPriority('medium')}>Medium</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => bulkSetPriority('low')}>Low</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={bulkDeleteSelected}>
            <Trash2 className="size-3.5 mr-1" /> Delete
          </Button>
          <button type="button" onClick={clearSelection} className="ml-auto p-1 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          {tasks.length === 0 ? (
            <>
              <CheckSquare className="size-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">No tasks yet. Create one to get started.</p>
              <Button size="sm" onClick={onNewTask}>
                <ListPlus className="size-4 mr-1.5" />
                New Task
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No tasks match your filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const course = task.course_id ? courseMap[task.course_id] : null
            const done = task.status === 'done'
            const today = todayStr()
            const now = new Date()
            let overdue = false
            if (!done) {
              if (task.due_date < today) {
                overdue = true
              } else if (task.due_date === today && task.due_time) {
                // Compare with due_time (HH:MM) for today's tasks
                const [h, m] = task.due_time.split(':').map(Number)
                const dueAt = new Date()
                dueAt.setHours(h, m, 0, 0)
                overdue = now > dueAt
              }
            }

            const taskSubtasks = subtasksMap?.get(task.id) ?? []
            const hasSubtasks = taskSubtasks.length > 0
            const expanded = expandedTaskId === task.id

            return (
              <div key={task.id}>
                <div
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer animate-in fade-in-0 duration-200"
                  onClick={() => {
                    if (hasSubtasks) setExpandedTaskId(expanded ? null : task.id)
                  }}
                >
                  {/* Expand chevron */}
                  {hasSubtasks ? (
                    <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}

                  {/* In select mode: blue selection checkbox. Otherwise: done/undone checkbox */}
                  {selectMode ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(task.id) }}
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
                        selectedIds.has(task.id)
                          ? 'bg-blue-500 dark:bg-blue-400 border-blue-500 dark:border-blue-400'
                          : 'border-muted-foreground/40 hover:border-blue-400 dark:hover:border-blue-300'
                      }`}
                    >
                      {selectedIds.has(task.id) && (
                        <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`Mark "${task.title}" as ${done ? 'incomplete' : 'complete'}`}
                      onClick={(e) => { e.stopPropagation(); toggleTask(task) }}
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
                  )}

                  {/* Course color dot */}
                  {course && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: course.color }}
                    />
                  )}

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate transition-all duration-300 ${done ? 'line-through text-muted-foreground opacity-60' : ''}`}>
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
                    <span className={`text-xs ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {relativeDueLabel(task.due_date)}{task.due_time ? ` ${formatTime24to12(task.due_time)}` : ''}
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
                    <span className="w-px h-4 bg-border" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task) }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Subtasks — animated expand/collapse */}
                {hasSubtasks && (
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                    style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-10 border-l pl-3 space-y-1 py-1">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleSubtaskDragEnd(task.id, e)} modifiers={[restrictToVerticalWithinContainer]}>
                          <SortableContext items={taskSubtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                            {taskSubtasks.map((sub, i) => {
                              const subDone = sub.status === 'complete'
                              const unlocked = subDone || taskSubtasks.slice(0, i).every((prev) => prev.status === 'complete')
                              return (
                                <SortableSubtaskRow
                                  key={sub.id}
                                  sub={sub}
                                  index={i}
                                  allSubs={taskSubtasks}
                                  unlocked={unlocked}
                                  onEdit={() => setSubtaskEditTarget(sub)}
                                  onToggle={() => {
                                    const newStatus = subDone ? 'pending' : 'complete'
                                    updateSubtask.mutate({ id: sub.id, status: newStatus })
                                    if (newStatus === 'complete') {
                                      const allOthersDone = taskSubtasks.every((s) => s.id === sub.id || s.status === 'complete')
                                      if (allOthersDone && task.status !== 'done') {
                                        updateTask.mutate({ id: task.id, status: 'done' })
                                      }
                                    }
                                  }}
                                />
                              )
                            })}
                          </SortableContext>
                        </DndContext>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <SubtaskModal
        open={subtaskEditTarget !== null}
        onClose={() => setSubtaskEditTarget(null)}
        subtask={subtaskEditTarget}
      />
    </div>
  )
}

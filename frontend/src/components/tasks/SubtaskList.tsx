import { useState, useEffect } from 'react'
import { GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'

const restrictToVerticalWithinContainer: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 }
  return {
    ...transform,
    x: 0,
    y: Math.min(Math.max(transform.y, containerNodeRect.top - draggingNodeRect.top), containerNodeRect.bottom - draggingNodeRect.bottom),
  }
}
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSubtasks, useUpdateSubtask, useReorderSubtasks } from '@/hooks/useSubtasks'
import { useFocusSessionsByTask } from '@/hooks/useFocusSessions'
import type { Subtask } from '@/types/database'

interface Props {
  taskId: string
  courseColor?: string
  reorderable?: boolean
  limit?: number
}

interface RowProps {
  s: Subtask
  index: number
  orderedSubtasks: Subtask[]
  focusedMin: number
  courseColor?: string
  reorderable: boolean
  editingId: string | null
  editingTitle: string
  onStartEdit: (id: string, title: string) => void
  onEditChange: (v: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onToggle: (id: string, current: string, index: number) => void
}

function SubtaskRow({
  s, index, orderedSubtasks, focusedMin, courseColor, reorderable,
  editingId, editingTitle, onStartEdit, onEditChange, onCommitEdit, onCancelEdit, onToggle,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: s.id,
    disabled: !reorderable,
  })

  const complete = s.status === 'complete'
  const unlocked = complete || orderedSubtasks.slice(0, index).every((p) => p.status === 'complete')
  const remaining = Math.max(0, s.estimated_minutes - focusedMin)
  const checkColor = courseColor ?? '#22c55e'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded border px-2 py-1.5 bg-background ${!unlocked ? 'opacity-40' : ''} ${isDragging ? 'opacity-50 shadow-lg z-50' : ''}`}
    >
      {reorderable && (
        <button
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={complete}
        aria-label={`Mark "${s.title}" ${complete ? 'incomplete' : 'complete'}`}
        onClick={() => onToggle(s.id, s.status, index)}
        disabled={!unlocked}
        className="w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center transition-colors"
        style={{
          borderColor: complete ? checkColor : unlocked ? undefined : undefined,
          backgroundColor: complete ? checkColor : 'transparent',
        }}
      >
        {complete && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {editingId === s.id ? (
        <input
          className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none"
          value={editingTitle}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitEdit()
            if (e.key === 'Escape') onCancelEdit()
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span
          className={`text-sm flex-1 min-w-0 truncate ${complete ? 'line-through text-muted-foreground' : unlocked ? 'cursor-text' : ''}`}
          onClick={() => { if (!complete && unlocked) onStartEdit(s.id, s.title) }}
        >
          {s.title}
        </span>
      )}

      <span className={`text-xs shrink-0 ${
        complete || remaining === 0 ? 'text-green-500' : focusedMin > 0 ? 'text-amber-500' : 'text-muted-foreground'
      }`}>
        {complete
          ? 'done'
          : remaining === 0
            ? `${s.estimated_minutes}m done`
            : focusedMin > 0
              ? `${remaining}m left`
              : `${s.estimated_minutes}m`}
      </span>
    </div>
  )
}

export function SubtaskList({ taskId, courseColor, reorderable = false, limit }: Props) {
  const { data: subtasks = [] } = useSubtasks(taskId)
  const { subtaskMinutesMap } = useFocusSessionsByTask(taskId)
  const updateSubtask = useUpdateSubtask()
  const reorderSubtasks = useReorderSubtasks()

  const [localOrder, setLocalOrder] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    setLocalOrder(subtasks.map((s) => s.id))
  }, [subtasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (subtasks.length === 0) return null

  const orderedSubtasks = localOrder
    .map((id) => subtasks.find((s) => s.id === id))
    .filter(Boolean) as Subtask[]

  const done = subtasks.filter((s) => s.status === 'complete').length

  function toggleStatus(id: string, current: string, index: number) {
    const allPreviousDone = orderedSubtasks.slice(0, index).every((s) => s.status === 'complete')
    if (!allPreviousDone && current !== 'complete') return
    updateSubtask.mutate({ id, status: current === 'complete' ? 'pending' : 'complete' })
  }

  function startEdit(id: string, title: string) {
    setEditingId(id)
    setEditingTitle(title)
  }

  function commitEdit() {
    if (!editingId) return
    const trimmed = editingTitle.trim()
    if (trimmed && trimmed !== subtasks.find((s) => s.id === editingId)?.title) {
      updateSubtask.mutate({ id: editingId, title: trimmed })
    }
    setEditingId(null)
    setEditingTitle('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingTitle('')
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string)
      const newIdx = prev.indexOf(over.id as string)
      if (oldIdx === -1 || newIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(oldIdx, 1)
      next.splice(newIdx, 0, moved)
      reorderSubtasks.mutate(next.map((id, i) => ({ id, order_index: i })))
      return next
    })
  }

  const visibleSubtasks = limit && !showAll ? orderedSubtasks.slice(0, limit) : orderedSubtasks
  const hiddenCount = limit ? Math.max(0, orderedSubtasks.length - limit) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Subtasks</p>
        <p className="text-xs text-muted-foreground">{done}/{subtasks.length} done</p>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalWithinContainer]}>
        <SortableContext items={orderedSubtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {visibleSubtasks.map((s, i) => (
              <SubtaskRow
                key={s.id}
                s={s}
                index={i}
                orderedSubtasks={orderedSubtasks}
                focusedMin={subtaskMinutesMap.get(s.id) ?? 0}
                courseColor={courseColor}
                reorderable={reorderable}
                editingId={editingId}
                editingTitle={editingTitle}
                onStartEdit={startEdit}
                onEditChange={setEditingTitle}
                onCommitEdit={commitEdit}
                onCancelEdit={cancelEdit}
                onToggle={toggleStatus}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {limit && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left pl-1"
        >
          {showAll
            ? 'Show less'
            : hiddenCount > 0
              ? `Show ${hiddenCount} more…`
              : null}
        </button>
      )}
    </div>
  )
}

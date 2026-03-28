import { useState, useEffect, useRef } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GripVertical, X, Plus, Loader2, RefreshCw, Paperclip } from 'lucide-react'
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
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const restrictToVerticalWithinContainer: Modifier = ({
  transform,
  draggingNodeRect,
  containerNodeRect,
}) => {
  if (!draggingNodeRect || !containerNodeRect) {
    return { ...transform, x: 0 }
  }
  const minY = containerNodeRect.top - draggingNodeRect.top
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom
  return {
    ...transform,
    x: 0,
    y: Math.min(Math.max(transform.y, minY), maxY),
  }
}
import { toast } from 'sonner'
import { useDecompose } from '@/hooks/useDecompose'
import { useSubtasks, useCreateSubtasks, useDeleteTaskSubtasks } from '@/hooks/useSubtasks'
import type { Task } from '@/types/database'

interface DraftSubtask {
  tempId: string
  title: string
  estimated_minutes: number
}

interface Props {
  open: boolean
  onClose: () => void
  task?: Task
  initialDescription?: string
  initialFileContent?: string
  initialFileName?: string
}

function SortableSubtaskRow({
  draft,
  onUpdate,
  onRemove,
}: {
  draft: DraftSubtask
  onUpdate: (field: keyof DraftSubtask, value: string | number) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: draft.tempId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border p-2 bg-background ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <Input
        className="flex-1 h-8 text-sm"
        placeholder="Subtask title"
        value={draft.title}
        onChange={(e) => onUpdate('title', e.target.value)}
      />

      <Input
        className="w-16 h-8 text-sm text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        type="number"
        min={5}
        max={240}
        step={5}
        value={draft.estimated_minutes}
        onChange={(e) => onUpdate('estimated_minutes', parseInt(e.target.value) || 0)}
      />
      <span className="text-xs text-muted-foreground shrink-0">min</span>

      <button
        type="button"
        className="p-1 hover:bg-destructive/10 hover:text-destructive rounded shrink-0"
        onClick={onRemove}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function DecompositionModal({ open, onClose, task, initialDescription, initialFileContent, initialFileName }: Props) {
  const [drafts, setDrafts] = useState<DraftSubtask[]>([])
  const [hasGenerated, setHasGenerated] = useState(false)
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [fileData, setFileData] = useState('')       // base64, for PDFs
  const [fileMediaType, setFileMediaType] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const decompose = useDecompose()
  const createSubtasks = useCreateSubtasks()
  const deleteTaskSubtasks = useDeleteTaskSubtasks()
  const { data: existingSubtasks = [] } = useSubtasks(task?.id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const autoGenerateRef = useRef(false)

  useEffect(() => {
    if (open) {
      // Pre-populate from initial context (e.g. "Save & Break Down" flow)
      if (initialDescription) setDescription(initialDescription)
      if (initialFileContent) setFileContent(initialFileContent)
      if (initialFileName) setFileName(initialFileName)
      // Auto-generate if context was provided
      if (initialDescription || initialFileContent) {
        autoGenerateRef.current = true
      }
    } else {
      setDrafts([])
      setHasGenerated(false)
      setDescription('')
      setFileName('')
      setFileContent('')
      setFileData('')
      setFileMediaType('')
      decompose.reset()
      autoGenerateRef.current = false
    }
  }, [open, task?.id])

  // Auto-generate after initial context is populated
  useEffect(() => {
    if (autoGenerateRef.current && open && task && !hasGenerated && !decompose.isPending) {
      autoGenerateRef.current = false
      generate()
    }
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const reader = new FileReader()
    if (isPdf) {
      reader.onload = () => {
        const dataUrl = reader.result as string
        setFileData(dataUrl.split(',')[1])   // strip "data:application/pdf;base64,"
        setFileMediaType('application/pdf')
        setFileContent('')
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = () => {
        setFileContent(reader.result as string)
        setFileData('')
        setFileMediaType('')
      }
      reader.readAsText(file)
    }
  }

  function removeFile() {
    setFileName('')
    setFileContent('')
    setFileData('')
    setFileMediaType('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function generate() {
    if (!task) return
    setHasGenerated(true)
    decompose.mutate(
      {
        taskId: task.id,
        description: description.trim() || undefined,
        fileContent: fileContent || undefined,
        fileName: fileName || undefined,
        fileData: fileData || undefined,
        fileMediaType: fileMediaType || undefined,
      },
      {
        onSuccess: (suggestions) => {
          setDrafts(
            suggestions.map((s) => ({
              tempId: crypto.randomUUID(),
              title: s.title,
              estimated_minutes: s.estimated_minutes,
            }))
          )
          toast.success(`Generated ${suggestions.length} subtask${suggestions.length !== 1 ? 's' : ''}`)
        },
        onError: () => {
          toast.error('Failed to generate subtasks')
        },
      }
    )
  }

  function handleRegenerate() {
    setDrafts([])
    decompose.reset()
    setHasGenerated(false)
    setTimeout(() => generate(), 0)
  }

  function updateDraft(tempId: string, field: keyof DraftSubtask, value: string | number) {
    setDrafts((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d))
    )
  }

  function removeDraft(tempId: string) {
    setDrafts((prev) => prev.filter((d) => d.tempId !== tempId))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDrafts((prev) => {
      const oldIndex = prev.findIndex((d) => d.tempId === active.id)
      const newIndex = prev.findIndex((d) => d.tempId === over.id)
      const next = [...prev]
      const [moved] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved)
      return next
    })
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), title: '', estimated_minutes: 30 },
    ])
  }

  async function handleConfirm() {
    if (!task || drafts.length === 0) return

    // Delete existing subtasks if re-decomposing
    if (existingSubtasks.length > 0) {
      await deleteTaskSubtasks.mutateAsync(task.id)
    }

    const inserts = drafts.map((d, i) => ({
      task_id: task.id,
      title: d.title,
      order_index: i,
      estimated_minutes: d.estimated_minutes,
    }))

    await createSubtasks.mutateAsync(inserts)
    toast.success(`${inserts.length} subtask${inserts.length !== 1 ? 's' : ''} saved`)
    onClose()
  }

  const totalMinutes = drafts.reduce((sum, d) => sum + d.estimated_minutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const totalDisplay = totalHours > 0
    ? `${totalHours}h ${remainingMinutes}m`
    : `${remainingMinutes}m`

  const isConfirming = createSubtasks.isPending || deleteTaskSubtasks.isPending
  const isLoading = decompose.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="pr-6">
            Break Down: {task?.title ?? 'Task'}
          </DialogTitle>
          {task && (
            <p className="text-sm text-muted-foreground">
              Due {task.due_date}
              {task.estimated_hours ? ` \u00b7 ${task.estimated_hours}h estimated` : ''}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-3 px-1 -mx-1">
          {/* Context step — shown before generating */}
          {!hasGenerated && !isLoading && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Describe the task (optional)</Label>
                <Textarea
                  placeholder="e.g. Write a 10-page research paper on machine learning ethics, needs at least 5 academic sources..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Attach a file (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Attach a rubric, assignment sheet, or syllabus to help the AI understand the task.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,.html,.py,.js,.ts,.tex,.rtf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {fileName ? (
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Paperclip className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{fileName}</span>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4 mr-1.5" />
                    Choose file
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Analyzing your task...</p>
                <p className="text-xs text-muted-foreground">Breaking it into focused steps</p>
              </div>
              <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-2/5" style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
              </div>
            </div>
          )}

          {/* Error state */}
          {decompose.isError && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-destructive mb-3">
                {decompose.error?.message || 'Something went wrong'}
              </p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="size-4 mr-1.5" />
                Try again
              </Button>
            </div>
          )}

          {/* Review state */}
          {!isLoading && !decompose.isError && drafts.length > 0 && (
            <>
              {existingSubtasks.length > 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  This task has {existingSubtasks.length} existing subtask{existingSubtasks.length > 1 ? 's' : ''}.
                  Confirming will replace them.
                </p>
              )}

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{drafts.length} subtask{drafts.length !== 1 ? 's' : ''}</span>
                <span>Total: {totalDisplay}</span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalWithinContainer]}
              >
                <SortableContext
                  items={drafts.map((d) => d.tempId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {drafts.map((draft) => (
                      <SortableSubtaskRow
                        key={draft.tempId}
                        draft={draft}
                        onUpdate={(field, value) => updateDraft(draft.tempId, field, value)}
                        onRemove={() => removeDraft(draft.tempId)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button variant="ghost" size="sm" className="w-full" onClick={addDraft}>
                <Plus className="size-4 mr-1.5" />
                Add subtask
              </Button>
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between pt-2 border-t">
          {!hasGenerated && !isLoading && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={generate}>Generate</Button>
            </div>
          )}
          {isLoading && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          )}
          {!isLoading && drafts.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="size-4 mr-1.5" />
                Regenerate
              </Button>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleConfirm}
                  disabled={isConfirming || drafts.some((d) => !d.title.trim())}
                >
                  {isConfirming ? 'Saving...' : 'Confirm'}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

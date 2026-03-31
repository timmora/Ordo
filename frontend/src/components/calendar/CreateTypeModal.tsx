import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarDays, CheckSquare } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSelectEvent: () => void
  onSelectTask: () => void
}

export function CreateTypeModal({ open, onClose, onSelectEvent, onSelectTask }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>What do you want to add?</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            type="button"
            onClick={() => { onClose(); onSelectEvent() }}
            className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-5 hover:bg-muted/60 transition-colors"
          >
            <CalendarDays className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">Event</span>
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onSelectTask() }}
            className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-5 hover:bg-muted/60 transition-colors"
          >
            <CheckSquare className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">Task</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { Button } from '@/components/ui/button'

interface Props {
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function InlineEmptyState({ message, actionLabel, onAction }: Props) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <span className="italic">{message}</span>
        {actionLabel && onAction && (
          <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

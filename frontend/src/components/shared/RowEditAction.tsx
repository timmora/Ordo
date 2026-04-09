import type { MouseEvent } from 'react'

interface Props {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
}

export function RowEditAction({ onClick, className }: Props) {
  return (
    <>
      <span className="w-px h-4 bg-border" />
      <button
        type="button"
        onClick={onClick}
        className={className ?? 'text-xs text-muted-foreground hover:text-foreground transition-colors'}
      >
        Edit
      </button>
    </>
  )
}

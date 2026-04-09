import type { ReactNode } from 'react'

interface RowMetaGroupProps {
  children: ReactNode
  className?: string
}

interface RowMetaTextProps {
  children: ReactNode
  className?: string
  mono?: boolean
}

export function RowMetaGroup({ children, className }: RowMetaGroupProps) {
  return <div className={className ?? 'flex items-center gap-1.5 shrink-0'}>{children}</div>
}

export function RowMetaText({ children, className, mono = false }: RowMetaTextProps) {
  return (
    <span className={className ?? `text-xs text-muted-foreground${mono ? ' font-mono' : ''}`}>
      {children}
    </span>
  )
}

import { Skeleton } from '@/components/ui/skeleton'

/** Skeleton for a single list row (tasks, events) */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <Skeleton className="w-2 h-2 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-3 w-16 shrink-0" />
    </div>
  )
}

/** Skeleton for the Tasks or Events tab list view */
export function ListTabSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      {/* Rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the Overview tab */
export function OverviewTabSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Greeting + clock */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      {/* Sections */}
      {[1, 2].map((s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          {[1, 2, 3].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Skeleton for the Calendar tab */
export function CalendarTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border overflow-hidden">
        {/* Day headers */}
        {Array.from({ length: 7 }, (_, i) => (
          <div key={`h${i}`} className="bg-muted p-2">
            <Skeleton className="h-3 w-8 mx-auto" />
          </div>
        ))}
        {/* Day cells */}
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="bg-card p-2 min-h-[80px] space-y-1">
            <Skeleton className="h-3 w-5" />
            {i % 4 === 0 && <Skeleton className="h-4 w-full rounded" />}
            {i % 7 === 2 && <Skeleton className="h-4 w-3/4 rounded" />}
          </div>
        ))}
      </div>
    </div>
  )
}

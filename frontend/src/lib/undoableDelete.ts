import { toast } from 'sonner'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Optimistically removes items from the React Query cache, shows an undo toast,
 * and defers the actual DB delete. If the user clicks Undo before the timer expires,
 * the cache is refetched (items still exist in DB).
 */
export function undoableDelete<T extends { id: string }>(options: {
  queryClient: QueryClient
  queryKey: string[]
  items: T[]
  deleteFn: () => Promise<void>
  message: string
  duration?: number
}) {
  const { queryClient, queryKey, items, deleteFn, message, duration = 5000 } = options
  const ids = new Set(items.map((i) => i.id))

  // Cancel in-flight queries so a background refetch doesn't override
  queryClient.cancelQueries({ queryKey })

  // Optimistically remove from cache
  queryClient.setQueryData<T[]>(queryKey, (old) =>
    (old ?? []).filter((item) => !ids.has(item.id)),
  )

  let undone = false

  const timeoutId = setTimeout(async () => {
    if (!undone) {
      try {
        await deleteFn()
      } catch {
        // Delete failed — refetch to restore
        queryClient.invalidateQueries({ queryKey })
      }
    }
  }, duration)

  toast(message, {
    action: {
      label: 'Undo',
      onClick: () => {
        undone = true
        clearTimeout(timeoutId)
        queryClient.invalidateQueries({ queryKey })
        toast.success('Restored')
      },
    },
    duration,
  })
}

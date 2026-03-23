import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SubtaskSuggestion } from '@/types/database'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

interface DecomposeInput {
  taskId: string
  description?: string
  fileContent?: string
  fileName?: string
}

export function useDecompose() {
  return useMutation({
    mutationFn: async ({ taskId, description, fileContent, fileName }: DecomposeInput): Promise<SubtaskSuggestion[]> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/decompose`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description, file_content: fileContent, file_name: fileName }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || 'Decomposition failed')
      }

      const data = await res.json()
      return data.subtasks as SubtaskSuggestion[]
    },
  })
}

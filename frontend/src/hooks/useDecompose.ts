import { useMutation } from '@tanstack/react-query'
import { backendFetch } from '@/lib/backendFetch'
import type { SubtaskSuggestion } from '@/types/database'

interface DecomposeInput {
  taskId: string
  description?: string
  fileContent?: string
  fileName?: string
}

export function useDecompose() {
  return useMutation({
    mutationFn: async ({ taskId, description, fileContent, fileName }: DecomposeInput): Promise<SubtaskSuggestion[]> => {
      const data = await backendFetch<{ subtasks: SubtaskSuggestion[] }>(
        `/api/tasks/${taskId}/decompose`,
        {
          method: 'POST',
          body: JSON.stringify({ description, file_content: fileContent, file_name: fileName }),
        },
      )
      return data.subtasks
    },
  })
}

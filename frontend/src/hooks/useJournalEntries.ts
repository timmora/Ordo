import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { JournalEntry, JournalPromptResponse } from '../types/database'

export function useJournalEntry(date: string) {
  return useQuery<JournalEntry | null>({
    queryKey: ['journal_entries', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
  })
}

export function useUpsertJournalEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      date,
      responses,
    }: {
      date: string
      responses: JournalPromptResponse[]
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('journal_entries')
        .upsert(
          { user_id: user.id, date, responses, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,date' }
        )
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['journal_entries', variables.date] })
    },
  })
}

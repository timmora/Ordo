import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Generic select-all query */
export function useSupabaseQuery<T>(
  table: string,
  queryKey: string[],
  orderBy?: string,
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from(table).select('*')
      if (orderBy) q = q.order(orderBy)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as T[]
    },
  })
}

/** Generic insert mutation */
export function useSupabaseInsert<TInsert, TReturn>(
  table: string,
  invalidateKeys: string[][],
  sideEffects?: (qc: QueryClient) => void,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInsert) => {
      const { data, error } = await supabase.from(table).insert(input).select().single()
      if (error) throw error
      return data as TReturn
    },
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      sideEffects?.(qc)
    },
  })
}

/** Generic update mutation */
export function useSupabaseUpdate<TReturn>(
  table: string,
  invalidateKeys: string[][],
  sideEffects?: (qc: QueryClient) => void,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TReturn> & { id: string }) => {
      const { data, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as TReturn
    },
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      sideEffects?.(qc)
    },
  })
}

/** Generic delete mutation */
export function useSupabaseDelete(
  table: string,
  invalidateKeys: string[][],
  sideEffects?: (qc: QueryClient) => void,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      sideEffects?.(qc)
    },
  })
}

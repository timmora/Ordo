import { supabase } from '@/lib/supabase'

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export async function backendFetch<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string> },
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const url = new URL(path, BACKEND_URL)
  url.searchParams.set('tz', tz)
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }

  const { params: _, ...fetchOpts } = options ?? {}
  const res = await fetch(url.toString(), {
    ...fetchOpts,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...fetchOpts?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

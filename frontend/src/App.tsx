import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import type { DateSelectArg } from '@fullcalendar/core'
import { supabase } from '@/lib/supabase'
import { CalendarView } from '@/components/calendar/CalendarView'
import { CourseSidebar } from '@/components/courses/CourseSidebar'
import { TaskSidebar } from '@/components/tasks/TaskSidebar'
import { EventModal } from '@/components/events/EventModal'
import { TaskModal } from '@/components/tasks/TaskModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarPlus, ListPlus, LogOut } from 'lucide-react'
import type { Event, Task } from '@/types/database'

const queryClient = new QueryClient()

function MainApp() {
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>()
  const [selectedTask, setSelectedTask] = useState<Task | undefined>()
  const [defaultStart, setDefaultStart] = useState<Date | undefined>()
  const [defaultEnd, setDefaultEnd] = useState<Date | undefined>()
  const [defaultAllDay, setDefaultAllDay] = useState(false)

  function handleDateSelect(arg: DateSelectArg) {
    setSelectedEvent(undefined)
    setDefaultStart(arg.start)
    setDefaultEnd(arg.end)
    setDefaultAllDay(arg.allDay)
    setEventModalOpen(true)
  }

  function handleEventClick(event: Event) {
    setSelectedEvent(event)
    setDefaultStart(undefined)
    setDefaultEnd(undefined)
    setDefaultAllDay(false)
    setEventModalOpen(true)
  }

  function handleTaskClick(task: Task) {
    setSelectedTask(task)
    setTaskModalOpen(true)
  }

  function openNewEvent() {
    setSelectedEvent(undefined)
    setDefaultStart(undefined)
    setDefaultEnd(undefined)
    setDefaultAllDay(false)
    setEventModalOpen(true)
  }

  function openNewTask() {
    setSelectedTask(undefined)
    setTaskModalOpen(true)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    queryClient.clear()
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
        <span className="font-semibold text-lg tracking-tight mr-2">Aporia</span>
        <Button size="sm" onClick={openNewEvent} variant="outline">
          <CalendarPlus className="size-4 mr-1.5" />
          Add Event
        </Button>
        <Button size="sm" onClick={openNewTask} variant="outline">
          <ListPlus className="size-4 mr-1.5" />
          Add Task
        </Button>
        <div className="ml-auto">
          <Button size="sm" variant="ghost" onClick={handleSignOut}>
            <LogOut className="size-4 mr-1.5" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 border-r overflow-y-auto p-3 space-y-6">
          <CourseSidebar />
          <TaskSidebar />
        </aside>
        <main className="flex-1 overflow-hidden p-3">
          <CalendarView
            onDateSelect={handleDateSelect}
            onEventClick={handleEventClick}
            onTaskClick={handleTaskClick}
          />
        </main>
      </div>

      <EventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        event={selectedEvent}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        defaultAllDay={defaultAllDay}
      />
      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={selectedTask}
      />
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSignupDone(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (signupDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-3">
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <Button variant="link" onClick={() => { setSignupDone(false); setMode('signin') }}>
            Back to sign in
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-center">Aporia</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="underline"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

function AppWithAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (!s) queryClient.clear()
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  return session ? <MainApp /> : <AuthScreen />
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppWithAuth />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

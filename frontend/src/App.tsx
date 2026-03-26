import { useState, useEffect, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import type { DateSelectArg } from '@fullcalendar/core'
import { supabase } from '@/lib/supabase'
import { CourseSidebar } from '@/components/courses/CourseSidebar'
import { EventModal } from '@/components/events/EventModal'
import { TaskModal } from '@/components/tasks/TaskModal'
import { DecompositionModal } from '@/components/tasks/DecompositionModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ScheduleBanner } from '@/components/ScheduleBanner'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { OverviewTab } from '@/components/tabs/OverviewTab'
import { CalendarTab } from '@/components/tabs/CalendarTab'
import { TasksTab } from '@/components/tabs/TasksTab'
import { EventsTab } from '@/components/tabs/EventsTab'
import { FocusTab } from '@/components/tabs/FocusTab'
import { JournalTab } from '@/components/tabs/JournalTab'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CalendarPlus,
  CalendarDays,
  ListPlus,
  LogOut,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Timer,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react'
import type { DecomposeContext } from '@/components/tasks/TaskModal'
import type { Event, Task } from '@/types/database'

const queryClient = new QueryClient()

type Tab = 'overview' | 'calendar' | 'events' | 'tasks' | 'focus' | 'journal'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="size-4" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="size-4" /> },
  { id: 'events', label: 'Events', icon: <CalendarDays className="size-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="size-4" /> },
  { id: 'focus', label: 'Focus', icon: <Timer className="size-4" /> },
  { id: 'journal', label: 'Journal', icon: <BookOpen className="size-4" /> },
]

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>()
  const [selectedTask, setSelectedTask] = useState<Task | undefined>()
  const [defaultStart, setDefaultStart] = useState<Date | undefined>()
  const [defaultEnd, setDefaultEnd] = useState<Date | undefined>()
  const [defaultAllDay, setDefaultAllDay] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [decomposeModalOpen, setDecomposeModalOpen] = useState(false)
  const [decomposeTask, setDecomposeTask] = useState<Task | undefined>()
  const [decomposeContext, setDecomposeContext] = useState<Omit<DecomposeContext, 'task'>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Lazy keep-alive: track which tabs have been visited so they mount on first visit then stay alive
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set([activeTab]))
  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab)
    setVisitedTabs((prev) => prev.has(tab) ? prev : new Set(prev).add(tab))
  }, [])

  // Keyboard shortcuts: Ctrl+E (new event), Ctrl+T (new task), 1-6 (switch tabs)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        openNewEvent()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault()
        openNewTask()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const idx = parseInt(e.key, 10)
        if (idx >= 1 && idx <= TABS.length) {
          switchTab(TABS[idx - 1].id)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  function handleDecompose(ctx: DecomposeContext) {
    setDecomposeTask(ctx.task)
    setDecomposeContext({
      description: ctx.description,
      fileContent: ctx.fileContent,
      fileName: ctx.fileName,
    })
    setDecomposeModalOpen(true)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    queryClient.clear()
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Courses sidebar — full height, collapsible to icon rail */}
      <aside
        className={`shrink-0 border-r overflow-x-hidden overflow-y-hidden transition-all duration-200 flex flex-col py-3 px-2 ${
          sidebarOpen ? 'w-56' : 'w-12'
        }`}
      >
        {/* Title + collapse toggle */}
        <div className="relative h-8 mb-3">
          <span className={`absolute left-2 top-1/2 -translate-y-1/2 font-serif font-semibold text-lg tracking-tight whitespace-nowrap transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>Ordo</span>
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="absolute right-0 top-0 flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="space-y-1 mb-3 overflow-hidden">
          <button
            type="button"
            onClick={openNewEvent}
            className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors overflow-hidden"
            title="Add Event"
          >
            <CalendarPlus className="size-4 shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Add Event</span>
          </button>
          <button
            type="button"
            onClick={openNewTask}
            className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors overflow-hidden"
            title="Add Task"
          >
            <ListPlus className="size-4 shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Add Task</span>
          </button>
        </div>

        {/* Courses */}
        <div className={`flex-1 min-h-0 overflow-hidden px-1 transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <CourseSidebar />
        </div>

        {/* Settings + Sign out at bottom */}
        <div className="mt-auto pt-2 border-t overflow-hidden space-y-1">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors overflow-hidden"
            title="Settings"
          >
            <Settings className="size-4 shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Settings</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors overflow-hidden"
            title="Sign out"
          >
            <LogOut className="size-4 shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Right column: header + tab content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-center px-4 h-14 border-b bg-background/80 backdrop-blur-sm shrink-0">
          {/* Tab navigation */}
          <nav className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </header>

        <ScheduleBanner />

        {/* Tab content — lazy keep-alive: mount on first visit, then stay alive via CSS hidden */}
        {visitedTabs.has('calendar') && (
          <div className={`flex-1 overflow-auto px-3 pt-5 pb-3 ${activeTab === 'calendar' ? '' : 'hidden'}`}>
            <CalendarTab
              onDateSelect={handleDateSelect}
              onEventClick={handleEventClick}
              onTaskClick={handleTaskClick}
            />
          </div>
        )}
        {visitedTabs.has('overview') && (
          <div className={`flex-1 overflow-auto px-6 py-4 ${activeTab === 'overview' ? '' : 'hidden'}`}>
            <OverviewTab onTaskClick={handleTaskClick} onDecompose={handleDecompose} onNavigate={(tab) => switchTab(tab as Tab)} />
          </div>
        )}
        {visitedTabs.has('events') && (
          <div className={`flex-1 overflow-auto px-6 py-4 ${activeTab === 'events' ? '' : 'hidden'}`}>
            <EventsTab onEventClick={handleEventClick} onNewEvent={openNewEvent} />
          </div>
        )}
        {visitedTabs.has('tasks') && (
          <div className={`flex-1 overflow-auto px-6 py-4 ${activeTab === 'tasks' ? '' : 'hidden'}`}>
            <TasksTab onTaskClick={handleTaskClick} onNewTask={openNewTask} onDecompose={handleDecompose} />
          </div>
        )}
        {visitedTabs.has('focus') && (
          <div className={`flex-1 overflow-auto px-6 py-4 ${activeTab === 'focus' ? '' : 'hidden'}`}>
            <FocusTab />
          </div>
        )}
        {visitedTabs.has('journal') && (
          <div className={`flex-1 overflow-auto px-6 py-4 ${activeTab === 'journal' ? '' : 'hidden'}`}>
            <JournalTab />
          </div>
        )}
      </div>

      {/* Modals — always mounted at root */}
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
        onDecompose={handleDecompose}
      />
      <DecompositionModal
        open={decomposeModalOpen}
        onClose={() => { setDecomposeModalOpen(false); setDecomposeContext({}) }}
        task={decomposeTask}
        initialDescription={decomposeContext.description}
        initialFileContent={decomposeContext.fileContent}
        initialFileName={decomposeContext.fileName}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
        <h1 className="text-2xl font-serif font-semibold text-center">Ordo</h1>
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

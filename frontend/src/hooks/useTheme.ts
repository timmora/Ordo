import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ordo_theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  // Suppress all CSS transitions for one frame so every element switches instantly
  const style = document.createElement('style')
  style.textContent = '*, *::before, *::after { transition: none !important; }'
  document.head.appendChild(style)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  // Remove after browser has painted the new frame
  requestAnimationFrame(() => { style.remove() })
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStored)

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    applyTheme(t)
  }, [])

  // Apply on mount
  useEffect(() => {
    applyTheme(theme)
  }, [])

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const resolved: 'light' | 'dark' = theme === 'system' ? getSystemTheme() : theme

  return { theme, resolved, setTheme }
}

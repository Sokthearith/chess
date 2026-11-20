import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME, THEMES, themeById, type Theme, type ThemeId } from './themes'

/**
 * The active theme. It lives on <html data-theme>, so every token in
 * themes.css switches at once; index.html sets the attribute before first
 * paint from the same localStorage key, so a reload never flashes the default.
 */
const KEY = 'counterplay.theme'
const listeners = new Set<() => void>()

function read(): ThemeId {
  try {
    return themeById(localStorage.getItem(KEY)).id
  } catch {
    return DEFAULT_THEME
  }
}

let current: ThemeId = read()

const loaded = new Set<string>()

/** Fetch a theme's web fonts once. Safe to call for every theme (the picker previews them all). */
export function loadThemeFonts(theme: Theme) {
  if (!theme.fonts || loaded.has(theme.id)) return
  loaded.add(theme.id)
  for (const q of Array.isArray(theme.fonts) ? theme.fonts : [theme.fonts]) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${q}&display=swap`
    link.dataset.theme = theme.id
    document.head.appendChild(link)
  }
}

function apply(id: ThemeId) {
  const theme = themeById(id)
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.chrome)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme.scheme)
  loadThemeFonts(theme)
}

if (typeof document !== 'undefined') apply(current)

export function setTheme(id: ThemeId) {
  if (id === current) return
  current = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* private mode: the theme lasts for this visit */
  }
  apply(id)
  for (const l of listeners) l()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useTheme(): Theme {
  const id = useSyncExternalStore(subscribe, () => current, () => DEFAULT_THEME)
  return themeById(id)
}

export { THEMES }

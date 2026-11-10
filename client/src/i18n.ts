import { useSyncExternalStore } from 'react'
import { zh } from './locales/zh'

export type Language = 'en' | 'zh-CN'
const STORAGE_KEY = 'opengrokbot.uiLanguage'
const listeners = new Set<() => void>()

function readLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'zh-CN' ? 'zh-CN' : 'en'
  } catch {
    return 'en'
  }
}

let language = readLanguage()

export function getLanguage(): Language {
  return language
}

function updateDocumentLanguage() {
  document.documentElement.lang = language
}

export function setLanguage(next: Language) {
  language = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // The current session can still switch when browser storage is unavailable.
  }
  updateDocumentLanguage()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** App subscribes once so language changes re-render the existing component tree. */
export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage)
}

/** English source text also serves as the fallback for technical names. */
export function t(source: string, values: Record<string, string | number> = {}): string {
  const text = language === 'zh-CN' && Object.hasOwn(zh, source) ? zh[source]! : source
  return text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}

updateDocumentLanguage()
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return
  language = readLanguage()
  updateDocumentLanguage()
  listeners.forEach((listener) => listener())
})

import { useCallback, useSyncExternalStore } from 'react'
import { isMuted, setMuted, subscribe } from './sounds'

export function useSoundSetting() {
  const muted = useSyncExternalStore(subscribe, isMuted, () => false)
  const toggle = useCallback(() => setMuted(!isMuted()), [])
  return { muted, toggle }
}

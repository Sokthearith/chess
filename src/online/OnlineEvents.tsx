import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadMe, onMessage } from './connection'

/**
 * App-wide online behaviour: learn who we are for the nav, and when a game
 * starts for us (a seek matched, a challenge accepted, a rematch), go to it
 * from whatever page we are on.
 */
export function OnlineEvents() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => loadMe(), [])
  useEffect(
    () =>
      onMessage((m) => {
        if (m.t === 'start' && !m.resume && pathname !== `/game/${m.id}`) navigate(`/game/${m.id}`)
      }),
    [navigate, pathname],
  )
  return null
}

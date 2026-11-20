import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { play } from '../sound/sounds'
import { useSoundSetting } from '../sound/useSound'
import { useOnline } from '../online/connection'
import { Crosshair } from './Crosshair'
import { ThemePicker } from './ThemePicker'

function SoundToggle() {
  const { muted, toggle } = useSoundSetting()
  return (
    <button
      type="button"
      className="nav__sound"
      aria-pressed={!muted}
      onClick={() => {
        toggle()
        if (muted) play('move')
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" />
        {muted ? (
          <path d="M13 7.5l4.5 5M17.5 7.5l-4.5 5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        ) : (
          <path d="M12.8 7a4 4 0 0 1 0 6M15.2 4.8a7 7 0 0 1 0 10.4" stroke="currentColor" strokeWidth="1.6" fill="none" />
        )}
      </svg>
      Sound — {muted ? 'off' : 'on'}
    </button>
  )
}

function AccountLink() {
  const { user, current } = useOnline()
  const { pathname } = useLocation()
  return (
    <>
      {current && pathname !== `/game/${current}` ? (
        <NavLink to={`/game/${current}`} className="nav__link nav__live">
          Your game
        </NavLink>
      ) : null}
      {user && !user.guest ? (
        <NavLink to={`/u/${user.name}`} className="nav__link nav__account">
          {user.name}
        </NavLink>
      ) : (
        <NavLink to={`/login${pathname.startsWith('/login') ? '' : `?next=${encodeURIComponent(pathname)}`}`} className="nav__link nav__account">
          Sign in
        </NavLink>
      )}
    </>
  )
}

export function Nav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <header className="nav">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="container nav__row">
        <NavLink to="/" className="wordmark" aria-label="Counterplay, home">
          <Crosshair />
          Counterplay
        </NavLink>
        <button type="button" className="nav__menu" aria-expanded={open} aria-controls="site-links" onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            {open ? <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" strokeWidth="1.8" /> : <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" />}
          </svg>
          Menu
        </button>
        <nav id="site-links" className={`nav__links${open ? ' nav__links--open' : ''}`} aria-label="Site">
          <NavLink to="/play" className="nav__link">
            Play
          </NavLink>
          <NavLink to="/online" className="nav__link">
            Online
          </NavLink>
          <NavLink to="/games" className="nav__link">
            Games
          </NavLink>
          <NavLink to="/analysis" className="nav__link">
            Analysis
          </NavLink>
          <NavLink to="/learn" className="nav__link">
            Learn
          </NavLink>
          <AccountLink />
          <SoundToggle />
          <ThemePicker />
          <NavLink to="/settings" className="nav__link nav__settings" aria-label="Settings">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M10 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7.2 4.4l-1.6-.3a5.9 5.9 0 0 1-.5 1.2l.9 1.4-1.6 1.6-1.4-.9c-.4.2-.8.4-1.2.5l-.3 1.6H8.5l-.3-1.6a5.9 5.9 0 0 1-1.2-.5l-1.4.9L4 13.3l.9-1.4a5.9 5.9 0 0 1-.5-1.2L2.8 10.4V8.6l1.6-.3c.1-.4.3-.8.5-1.2L4 5.7 5.6 4.1l1.4.9c.4-.2.8-.4 1.2-.5l.3-1.6h2.2l.3 1.6c.4.1.8.3 1.2.5l1.4-.9 1.6 1.6-.9 1.4c.2.4.4.8.5 1.2l1.6.3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <span className="nav__settings-label">Settings</span>
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

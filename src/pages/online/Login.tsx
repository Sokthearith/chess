import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { login, register } from '../../online/api'
import { PASSWORD_MIN, USERNAME_RE } from '../../online/protocol'

/** Only same-site paths: never bounce to another origin after signing in. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/online'
}

export function Login() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const mode = params.get('mode') === 'signup' ? 'signup' : 'signin'
  const next = safeNext(params.get('next'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const switchTo = (m: 'signin' | 'signup') => {
    const p = new URLSearchParams(params)
    if (m === 'signup') p.set('mode', 'signup')
    else p.delete('mode')
    setParams(p, { replace: true })
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup') {
      if (!USERNAME_RE.test(username)) return setError('Usernames are 3 to 20 letters, digits, - or _, starting with a letter or digit.')
      if (password.length < PASSWORD_MIN) return setError(`Use at least ${PASSWORD_MIN} characters for the password.`)
    }
    setBusy(true)
    try {
      if (mode === 'signup') await register(username.trim(), password)
      else await login(username.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Nav />
      <main id="main" className="container account">
        <section className="account__card">
          <h1>{mode === 'signup' ? 'Create an account' : 'Sign in'}</h1>
          <p className="lead">{mode === 'signup' ? 'An account keeps your rating and game history, and lets you play rated games.' : 'Welcome back. Your rating is where you left it.'}</p>
          <div className="seg__row account__tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={`seg__opt${mode === 'signin' ? ' seg__opt--on' : ''}`} onClick={() => switchTo('signin')}>
              <span className="seg__label">Sign in</span>
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={`seg__opt${mode === 'signup' ? ' seg__opt--on' : ''}`} onClick={() => switchTo('signup')}>
              <span className="seg__label">New account</span>
            </button>
          </div>
          <form className="account__form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="acct-user" className="mono mono--sm">
                Username
              </label>
              <input
                id="acct-user"
                className="input"
                name="username"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              {mode === 'signup' ? <p className="mono mono--sm mono--mute">3 to 20 letters, digits, - or _. Everyone sees it.</p> : null}
            </div>
            <div className="field">
              <label htmlFor="acct-pass" className="mono mono--sm">
                Password
              </label>
              <input
                id="acct-pass"
                className="input"
                type="password"
                name="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === 'signup' ? <p className="mono mono--sm mono--mute">At least {PASSWORD_MIN} characters. There is no password reset yet, so keep it somewhere safe.</p> : null}
            </div>
            <p className="connect__help connect__help--error mono mono--sm" role="alert">
              {error ?? ''}
            </p>
            <button type="submit" className="btn setup__start" aria-busy={busy || undefined} disabled={busy}>
              {busy ? 'One moment' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <p className="mono mono--sm mono--mute">
            Or <Link to="/online">play as a guest</Link>: casual games, no sign-up.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}

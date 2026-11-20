import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { login, recover, register } from '../../online/api'
import { PASSWORD_MIN, USERNAME_RE } from '../../online/protocol'
import { RecoveryCode } from './RecoveryCode'

/** Only same-site paths: never bounce to another origin after signing in. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/online'
}

type Mode = 'signin' | 'signup' | 'recover'

export function Login() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const raw = params.get('mode')
  const mode: Mode = raw === 'signup' ? 'signup' : raw === 'recover' ? 'recover' : 'signin'
  const next = safeNext(params.get('next'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** After sign-up or a reset: the new recovery code, shown before going on. */
  const [issued, setIssued] = useState<{ code: string; username: string; reset: boolean } | null>(null)

  const switchTo = (m: Mode) => {
    const p = new URLSearchParams(params)
    if (m === 'signin') p.delete('mode')
    else p.set('mode', m)
    setParams(p, { replace: true })
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup' && !USERNAME_RE.test(username)) return setError('Usernames are 3 to 20 letters, digits, - or _, starting with a letter or digit.')
    if (mode === 'recover' && !code.trim()) return setError('Enter the recovery code you saved when you made the account.')
    if (mode !== 'signin' && password.length < PASSWORD_MIN) return setError(`Use at least ${PASSWORD_MIN} characters for the password.`)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const out = await register(username.trim(), password)
        setIssued({ code: out.recoveryCode, username: out.user.name, reset: false })
      } else if (mode === 'recover') {
        const out = await recover(username.trim(), code, password)
        setIssued({ code: out.recoveryCode, username: out.user.name, reset: true })
      } else {
        await login(username.trim(), password)
        navigate(next, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (issued) {
    return (
      <>
        <Nav />
        <main id="main" className="container account">
          <section className="account__card">
            <h1>{issued.reset ? 'Password changed' : 'Account made'}</h1>
            <p className="lead">
              {issued.reset
                ? 'You are signed in with your new password, and signed out everywhere else. Your old recovery code no longer works: here is the new one.'
                : `Welcome, ${issued.username}. One last thing before you play.`}
            </p>
            <RecoveryCode code={issued.code} username={issued.username} onDone={() => navigate(next, { replace: true })} doneLabel={issued.reset ? 'Continue' : 'Start playing'} />
          </section>
        </main>
        <Footer />
      </>
    )
  }

  const heading = mode === 'signup' ? 'Create an account' : mode === 'recover' ? 'Reset your password' : 'Sign in'
  const lead =
    mode === 'signup'
      ? 'An account keeps your rating and game history, and lets you play rated games.'
      : mode === 'recover'
        ? 'Use the recovery code you saved when you made the account. You get a new code afterwards.'
        : 'Welcome back. Your rating is where you left it.'

  return (
    <>
      <Nav />
      <main id="main" className="container account">
        <section className="account__card">
          <h1>{heading}</h1>
          <p className="lead">{lead}</p>
          {mode !== 'recover' ? (
            <div className="seg__row account__tabs" role="tablist" aria-label="Account">
              <button type="button" role="tab" aria-selected={mode === 'signin'} className={`seg__opt${mode === 'signin' ? ' seg__opt--on' : ''}`} onClick={() => switchTo('signin')}>
                <span className="seg__label">Sign in</span>
              </button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={`seg__opt${mode === 'signup' ? ' seg__opt--on' : ''}`} onClick={() => switchTo('signup')}>
                <span className="seg__label">New account</span>
              </button>
            </div>
          ) : null}
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
            {mode === 'recover' ? (
              <div className="field">
                <label htmlFor="acct-code" className="mono mono--sm">
                  Recovery code
                </label>
                <input
                  id="acct-code"
                  className="input"
                  name="recovery-code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={32}
                  placeholder="XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="acct-pass" className="mono mono--sm">
                {mode === 'recover' ? 'New password' : 'Password'}
              </label>
              <input
                id="acct-pass"
                className="input"
                type="password"
                name="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === 'signup' ? <p className="mono mono--sm mono--mute">At least {PASSWORD_MIN} characters. Next you get a recovery code, in case you forget it.</p> : null}
              {mode === 'recover' ? <p className="mono mono--sm mono--mute">At least {PASSWORD_MIN} characters.</p> : null}
            </div>
            <p className="connect__help connect__help--error mono mono--sm" role="alert">
              {error ?? ''}
            </p>
            <button type="submit" className="btn setup__start" aria-busy={busy || undefined} disabled={busy}>
              {busy ? 'One moment' : mode === 'signup' ? 'Create account' : mode === 'recover' ? 'Set new password' : 'Sign in'}
            </button>
          </form>
          {mode === 'signin' ? (
            <button type="button" className="account__link mono mono--sm" onClick={() => switchTo('recover')}>
              Forgot your password?
            </button>
          ) : mode === 'recover' ? (
            <>
              <p className="mono mono--sm mono--mute">Lost the code too? Then the account cannot be recovered: there is no email on file. You can make a new one.</p>
              <button type="button" className="account__link mono mono--sm" onClick={() => switchTo('signin')}>
                Back to sign in
              </button>
            </>
          ) : null}
          <p className="mono mono--sm mono--mute">
            Or <Link to="/online">play as a guest</Link>: casual games, no sign-up.
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}

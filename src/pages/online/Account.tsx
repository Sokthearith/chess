import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { changePassword, logout, newRecoveryCode } from '../../online/api'
import { connect, useOnline } from '../../online/connection'
import { PASSWORD_MIN } from '../../online/protocol'
import { RecoveryCode } from './RecoveryCode'

/** A small form that needs the current password, with its own error line. */
function PasswordForm({
  id,
  submitLabel,
  extra,
  onSubmit,
}: {
  id: string
  submitLabel: string
  extra?: (busy: boolean) => ReactNode
  onSubmit: (current: string) => Promise<string | null>
}) {
  const [current, setCurrent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const problem = await onSubmit(current)
      if (problem) setError(problem)
      else setCurrent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="account__form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-current`} className="mono mono--sm">
          Current password
        </label>
        <input
          id={`${id}-current`}
          className="input"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      {extra?.(busy)}
      <p className="connect__help connect__help--error mono mono--sm" role="alert">
        {error ?? ''}
      </p>
      <button type="submit" className="btn btn--sm" aria-busy={busy || undefined} disabled={busy} style={{ justifySelf: 'start' }}>
        {busy ? 'One moment' : submitLabel}
      </button>
    </form>
  )
}

export function Account() {
  const { user, status } = useOnline()
  const navigate = useNavigate()
  const [code, setCode] = useState<string | null>(null)
  const [next, setNext] = useState('')
  const [changed, setChanged] = useState(false)
  useEffect(() => connect(), [])

  if (!user) {
    return (
      <>
        <Nav />
        <main id="main" className="container account">
          <p className="mono mono--mute waiting-dot" role="status">
            {status === 'reconnecting' ? 'Reaching the server' : 'Loading your account'}
          </p>
        </main>
        <Footer />
      </>
    )
  }
  if (user.guest) return <Navigate to="/login?next=/account" replace />

  return (
    <>
      <Nav />
      <main id="main" className="container account">
        <section className="account__card" aria-labelledby="acct-head">
          <h1 id="acct-head">Your account</h1>
          <p className="lead">
            Signed in as <Link to={`/u/${user.name}`}>{user.name}</Link>.
          </p>

          <section className="account__section" aria-labelledby="rec-head">
            <h2 id="rec-head">Recovery code</h2>
            {code ? (
              <RecoveryCode code={code} username={user.name} onDone={() => setCode(null)} doneLabel="Done" />
            ) : (
              <>
                <p>
                  {user.recovery
                    ? 'You have a recovery code. Make a new one if you lost it, or think someone else has seen it: the old one stops working.'
                    : 'You have no recovery code yet. Without one, a forgotten password means the account is lost for good.'}
                </p>
                <PasswordForm
                  id="rec"
                  submitLabel={user.recovery ? 'Make a new code' : 'Make my recovery code'}
                  onSubmit={async (current) => {
                    setCode(await newRecoveryCode(current))
                    return null
                  }}
                />
              </>
            )}
          </section>

          <section className="account__section" aria-labelledby="pw-head">
            <h2 id="pw-head">Change password</h2>
            <p>Every other device you are signed in on is signed out.</p>
            {changed ? (
              <p className="mono mono--sm" role="status">
                Password changed. Other devices are signed out.
              </p>
            ) : null}
            <PasswordForm
              id="pw"
              submitLabel="Change password"
              extra={() => (
                <div className="field">
                  <label htmlFor="pw-next" className="mono mono--sm">
                    New password
                  </label>
                  <input
                    id="pw-next"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    value={next}
                    onChange={(e) => {
                      setNext(e.target.value)
                      setChanged(false)
                    }}
                    required
                  />
                  <p className="mono mono--sm mono--mute">At least {PASSWORD_MIN} characters.</p>
                </div>
              )}
              onSubmit={async (current) => {
                if (next.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters for the new password.`
                await changePassword(current, next)
                setNext('')
                setChanged(true)
                return null
              }}
            />
          </section>

          <section className="account__section" aria-labelledby="out-head">
            <h2 id="out-head">Sign out</h2>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              style={{ justifySelf: 'start' }}
              onClick={async () => {
                await logout().catch(() => {})
                navigate('/online')
              }}
            >
              Sign out on this device
            </button>
          </section>
        </section>
      </main>
      <Footer />
    </>
  )
}

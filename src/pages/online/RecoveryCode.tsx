import { useState } from 'react'

/**
 * A recovery code, shown once. There is no email on Oukplay: this code is the
 * only way back into the account after a forgotten password, so the player
 * has to say they saved it before moving on.
 */
export function RecoveryCode({ code, username, onDone, doneLabel = 'Continue' }: { code: string; username: string; onDone: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: the code is selectable */
    }
  }
  const download = () => {
    const text = `Oukplay recovery code\n\nUsername: ${username}\nRecovery code: ${code}\n\nUse it on the sign-in page under "Forgot your password?".\nIt works once; you get a new one each time you use it.\n`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `oukplay-recovery-${username}.txt`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="recovery">
      <p className="mono mono--sm">Your recovery code</p>
      <p className="recovery__code display" aria-label={`Recovery code ${code.split('').join(' ')}`}>
        {code}
      </p>
      <p>
        If you forget your password, this code is the only way back into <strong>{username}</strong>. There is no email reset. Keep it somewhere safe, away from this
        browser: a password manager, a note on your phone, or on paper.
      </p>
      <div className="play__controls">
        <button type="button" className="btn btn--sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={download}>
          Save as a file
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I have saved my recovery code</span>
      </label>
      <button type="button" className="btn setup__start" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </button>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { LearnTabs } from './LearnTabs'
import { useRoadmap } from '../../learn/roadmap'

const pad = (n: number) => String(n).padStart(2, '0')

/** The whole road, beginner to advanced: four stages, each a path of steps. */
export function Roadmap() {
  const road = useRoadmap()
  const current = road.next?.stage.id ?? null
  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn">
        <header className="learn__head">
          <p className="mono mono--sm">
            <Link to="/learn">Learn</Link> — roadmap
          </p>
          <h1>Roadmap</h1>
          <p className="lead">From the first pawn move to the bishop and knight mate. Walk it in order, or jump to anything: nothing is locked, and what you have already done is ticked off.</p>
          <div className="road__summary">
            <p className="mono mono--sm">
              Done — {road.done} of {road.total}
              {road.next ? ` · now — ${road.next.stage.title.toLowerCase()}` : ' · road complete'}
            </p>
            <Meter value={road.done} max={road.total} label="Roadmap progress" />
            {road.next ? (
              <Link className="btn" to={road.next.step.to}>
                Continue — {road.next.step.title}
              </Link>
            ) : null}
          </div>
          <nav className="road__jump" aria-label="Stages">
            {road.stages.map(({ stage, steps, done }, si) => (
              <a key={stage.id} href={`#st-${stage.id}`} className={`chip${stage.id === current ? ' chip--on' : ''}`}>
                {si + 1}. {stage.title} <span className="mono--mute">{done}/{steps.length}</span>
              </a>
            ))}
          </nav>
        </header>

        <ol className="road">
          {road.stages.map(({ stage, steps, done }, si) => {
            const state = done === steps.length ? 'done' : stage.id === current ? 'now' : 'later'
            return (
              <li key={stage.id} className={`stage stage--${state}`} aria-labelledby={`st-${stage.id}`}>
                <div className="stage__head">
                  <span className="stage__n" aria-hidden="true">
                    {pad(si + 1)}
                  </span>
                  <div className="stage__text">
                    <p className="mono mono--sm mono--mute">
                      Stage {si + 1} — {stage.band}
                    </p>
                    <h2 id={`st-${stage.id}`}>{stage.title}</h2>
                    <p className="stage__goal">{stage.goal}</p>
                  </div>
                  <div className="stage__count">
                    <span className="mono mono--sm">
                      {done} of {steps.length}
                    </span>
                    <Meter value={done} max={steps.length} label={`${stage.title} progress`} />
                  </div>
                </div>
                <ol className="path">
                  {steps.map((v, i) => {
                    const isNext = road.next?.step.key === v.key && road.next.stage.id === stage.id
                    return (
                      <li key={v.key}>
                        <Link to={v.to} className={`step${v.done ? ' step--done' : ''}${isNext ? ' step--next' : ''}`} aria-current={isNext ? 'step' : undefined}>
                          <span className="step__mark" aria-hidden="true">
                            {v.done ? (
                              <svg viewBox="0 0 12 12" width="12" height="12">
                                <path d="M2 6.5 5 9.5 10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                              </svg>
                            ) : null}
                          </span>
                          <span className="step__n mono mono--sm">
                            {si + 1}.{pad(i + 1)} — {v.kind}
                          </span>
                          <span className="step__title">{v.title}</span>
                          <span className="step__body">{v.body}</span>
                          <span className="step__state mono mono--sm">{isNext ? 'next' : v.done ? 'done' : (v.state ?? 'start')}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </li>
            )
          })}
        </ol>
      </main>
      <Footer />
    </>
  )
}

/** A flat ruled bar: ink fill on paper, no rounding. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <span className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="meter__fill" style={{ width: `${pct}%` }} />
    </span>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { LearnTabs } from './LearnTabs'
import { MOTIFS, MOTIF_GROUPS } from '../../learn/motifs'
import { loadPuzzles } from '../../learn/puzzles'

/** Count puzzles per theme once the set has loaded. */
export function useThemeCounts(): Map<string, number> | null {
  const [counts, setCounts] = useState<Map<string, number> | null>(null)
  useEffect(() => {
    void loadPuzzles().then((all) => {
      const m = new Map<string, number>()
      for (const p of all) for (const t of p.themes) m.set(t, (m.get(t) ?? 0) + 1)
      setCounts(m)
    })
  }, [])
  return counts
}

export function Middlegame() {
  const counts = useThemeCounts()
  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn">
        <header className="learn__head">
          <p className="mono mono--sm">
            <Link to="/learn">Learn</Link> — middlegame
          </p>
          <h1>Middlegame</h1>
          <p className="lead">Most games are decided by a handful of patterns. Read the idea, then train it on positions where it wins the game.</p>
        </header>
        {MOTIF_GROUPS.map((g) => (
          <section key={g.id} className="shelf" aria-labelledby={`m-${g.id}`}>
            <div className="shelf__head">
              <h2 id={`m-${g.id}`}>{g.title}</h2>
            </div>
            <ol className="rows">
              {MOTIFS.filter((m) => m.group === g.id).map((m) => (
                <li key={m.theme}>
                  <Link to={`/learn/puzzles?theme=${m.theme}`} className="row">
                    <span className="row__eco mono mono--sm mono--mute">{counts?.get(m.theme) ?? '…'}</span>
                    <span className="row__title">{m.title}</span>
                    <span className="row__body">
                      {m.idea} <span className="mono--mute">{m.look}</span>
                    </span>
                    <span className="row__state mono mono--sm">Train</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </main>
      <Footer />
    </>
  )
}

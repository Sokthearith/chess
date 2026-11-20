import { Piece } from '../../board/Piece'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import { badgeFraction, useBadges, type BadgeView } from '../../learn/badges'
import { LearnTabs } from './LearnTabs'

const GROUPS: BadgeView['badge']['group'][] = ['Roadmap', 'Puzzles', 'Arcade', 'Study', 'Habit', 'Rank']

export function BadgeCard({ v }: { v: BadgeView }) {
  const { badge, value, earned, at } = v
  const pct = badgeFraction(v) * 100
  const shown = badge.percent ? `${Math.round(Math.min(1, value) * 100)}%` : `${Math.min(value, badge.target)} of ${badge.target}`
  return (
    <li className={`badge-card${earned ? ' badge-card--earned' : ''}`}>
      <span className="medal" aria-hidden="true">
        <Piece type={badge.piece} color={earned ? 'w' : 'b'} />
      </span>
      <span className="badge-card__text">
        <span className="badge-card__title">{badge.title}</span>
        <span className="badge-card__desc">{badge.desc}</span>
        {earned ? (
          <span className="mono mono--sm badge-card__state">Earned{at ? ` — ${new Date(at).toLocaleDateString()}` : ''}{badge.bonus ? ` · +${badge.bonus} XP` : ''}</span>
        ) : (
          <span className="badge-card__progress">
            <span className="meter" aria-hidden="true">
              <span className="meter__fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="mono mono--sm mono--mute">{shown}</span>
          </span>
        )}
      </span>
    </li>
  )
}

export function BadgesPage() {
  const views = useBadges()
  const earned = views.filter((v) => v.earned).length
  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn">
        <header className="learn__head">
          <h1>Badges</h1>
          <p className="lead">
            {earned} of {views.length} earned. Each badge marks something you can now do at the board, from your first solved puzzle to the bishop-and-knight mate.
          </p>
        </header>
        {GROUPS.map((group) => {
          const list = views.filter((v) => v.badge.group === group)
          return (
            <section key={group} className="shelf" aria-labelledby={`bg-${group}`}>
              <div className="shelf__head">
                <h2 id={`bg-${group}`}>{group}</h2>
                <p className="mono mono--sm mono--mute">
                  {list.filter((v) => v.earned).length} of {list.length}
                </p>
              </div>
              <ul className="badge-grid">
                {list.map((v) => (
                  <BadgeCard key={v.badge.id} v={v} />
                ))}
              </ul>
            </section>
          )
        })}
      </main>
      <Footer />
    </>
  )
}

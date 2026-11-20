import { NavLink } from 'react-router-dom'
import { LearnHud } from '../../components/LearnHud'
import { useBadgeWatcher } from '../../learn/badges'

const TABS = [
  { to: '/learn', label: 'Overview', end: true },
  { to: '/learn/roadmap', label: 'Roadmap' },
  { to: '/learn/lessons', label: 'Lessons' },
  { to: '/learn/puzzles', label: 'Puzzles' },
  { to: '/learn/arcade', label: 'Arcade' },
  { to: '/learn/openings', label: 'Openings' },
  { to: '/learn/middlegame', label: 'Middlegame' },
  { to: '/learn/endgames', label: 'Endgames' },
  { to: '/learn/badges', label: 'Badges' },
]

/** The learning section's own bar, under the site nav on every learn page. It scrolls sideways on phones. */
export function LearnTabs() {
  useBadgeWatcher()
  return (
    <nav className="learn-tabs" aria-label="Learn">
      <div className="container learn-tabs__wrap">
      <div className="learn-tabs__row">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="learn-tabs__tab">
            {t.label}
          </NavLink>
        ))}
      </div>
      <LearnHud />
      </div>
    </nav>
  )
}

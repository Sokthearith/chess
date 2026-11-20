import { Link, useNavigate } from 'react-router-dom'
import { storePgn } from '../analysis/library'
import { unsaveGame, useSavedGames, type SavedGame } from '../library/saved'

/** Saved games, newest first: open one for review, or unsave it. */
export function SavedList({ empty }: { empty?: React.ReactNode }) {
  const saved = useSavedGames()
  const navigate = useNavigate()
  const open = (g: SavedGame) => {
    if (g.pgn) {
      try {
        navigate(`/analysis/pgn/${storePgn(g.pgn, g.title, g.source)}`)
        return
      } catch {
        /* fall back to the stored route */
      }
    }
    if (g.to) navigate(g.to)
  }
  if (!saved.length) return empty ? <>{empty}</> : null
  return (
    <ol className="recent__list saved__list">
      {saved.map((g) => (
        <li key={g.id} className="recent__row">
          <button type="button" className="recent__link saved__open" onClick={() => open(g)}>
            <span className="recent__title">{g.title}</span>
            <span className="mono mono--sm mono--mute">
              {[g.source, g.date, g.result].filter(Boolean).join(' · ')}
            </span>
          </button>
          <button type="button" className="recent__x" aria-label={`Remove ${g.title} from saved games`} onClick={() => unsaveGame(g.id)}>
            ×
          </button>
        </li>
      ))}
    </ol>
  )
}

export function SavedEmpty() {
  return (
    <p className="saved__empty">
      Nothing saved yet. Press <b>Save game</b> on any review, or the star next to a Chess.com game, and it stays here. <Link to="/analysis">Browse famous games</Link>.
    </p>
  )
}

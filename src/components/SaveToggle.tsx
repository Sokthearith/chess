import { saveGame, unsaveGame, useSavedGames, type SavedGame } from '../library/saved'

/** A star button: save this game to the list, or take it off again. */
export function SaveToggle({ game, small = false }: { game: Omit<SavedGame, 'savedAt'>; small?: boolean }) {
  const saved = useSavedGames().some((g) => g.id === game.id)
  return (
    <button
      type="button"
      className={`btn btn--quiet${small ? ' btn--sm' : ''} save-toggle${saved ? ' save-toggle--on' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${game.title} from saved games` : `Save ${game.title}`}
      onClick={() => (saved ? unsaveGame(game.id) : saveGame(game))}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 2.2l2.4 5 5.4.6-4 3.7 1.1 5.4L10 14.2l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {small ? null : saved ? 'Saved' : 'Save game'}
    </button>
  )
}

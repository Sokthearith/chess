import { Link } from 'react-router-dom'
import { useTheme } from '../theme/useTheme'

export function Footer() {
  const theme = useTheme()
  return (
    <footer className="footer">
      <div className="container footer__row">
        <p className="mono mono--mute">Oukplay — theme: {theme.name}</p>
        <div className="footer__links mono">
          <Link to="/play">Play</Link>
          <Link to="/online">Online</Link>
          <Link to="/games">Games</Link>
          <Link to="/analysis">Analysis</Link>
          <Link to="/learn">Learn</Link>
          <Link to="/learn/puzzles">Puzzles</Link>
          <Link to="/settings">Settings</Link>
          <span className="mono--mute">{theme.colophon} Rules by chess.js. Pieces drawn for this board.</span>
        </div>
      </div>
    </footer>
  )
}

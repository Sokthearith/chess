import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Nav } from '../components/Nav'

/** Any URL the router does not know. */
export function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="container learn notfound">
        <header className="learn__head">
          <p className="mono mono--sm mono--mute">Error — 404</p>
          <h1>Illegal move</h1>
          <p className="lead">There is no page at this address. It may have moved, or the link has a typo.</p>
        </header>
        <div className="play__controls">
          <Link className="btn" to="/play">
            Play a game
          </Link>
          <Link className="btn btn--quiet" to="/learn">
            Learn
          </Link>
          <Link className="btn btn--quiet" to="/">
            Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}

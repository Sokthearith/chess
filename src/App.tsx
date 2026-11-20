import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Landing } from './pages/Landing'
import { Play } from './pages/Play'
import { Games } from './pages/Games'
import { Analysis } from './pages/Analysis'
import { LearnHub } from './pages/learn/LearnHub'
import { Puzzles } from './pages/learn/Puzzles'
import { OpeningLessonPage, OpeningsIndex } from './pages/learn/Openings'
import { Middlegame } from './pages/learn/Middlegame'
import { EndgameDrillPage, EndgamesIndex } from './pages/learn/Endgames'
import { LessonPage, LessonsIndex } from './pages/learn/Lessons'
import { Roadmap } from './pages/learn/Roadmap'
import { Arcade } from './pages/learn/Arcade'
import { BadgesPage } from './pages/learn/Badges'
import { NotFound } from './pages/NotFound'
import { Settings } from './pages/Settings'
import { Toasts } from './components/Toasts'
import { Lobby } from './pages/online/Lobby'
import { OnlineGame } from './pages/online/OnlineGame'
import { Login } from './pages/online/Login'
import { Profile } from './pages/online/Profile'
import { OnlineEvents } from './online/OnlineEvents'

function TitleAndScroll() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const name =
      pathname === '/play'
        ? 'Play'
        : pathname === '/online'
          ? 'Play online'
          : pathname.startsWith('/game/')
            ? 'Online game'
            : pathname === '/login'
              ? 'Sign in'
              : pathname.startsWith('/u/')
                ? decodeURIComponent(pathname.slice(3))
                : pathname.startsWith('/games')
          ? 'Games'
          : pathname.startsWith('/analysis')
            ? 'Analysis'
            : pathname.startsWith('/learn/puzzles')
              ? 'Puzzles'
              : pathname.startsWith('/learn/arcade')
                ? 'Arcade'
                : pathname.startsWith('/learn/badges')
                  ? 'Badges'
              : pathname.startsWith('/learn/openings')
                ? 'Openings'
                : pathname.startsWith('/learn/middlegame')
                  ? 'Middlegame'
                  : pathname.startsWith('/learn/endgames')
                    ? 'Endgames'
                    : pathname.startsWith('/learn/roadmap')
                      ? 'Roadmap'
                      : pathname.startsWith('/learn/lessons')
                        ? 'Lessons'
                        : pathname.startsWith('/settings')
                      ? 'Settings'
                      : pathname.startsWith('/learn')
                      ? 'Learn'
                      : ''
    document.title = name ? `${name}, Counterplay` : 'Counterplay'
  }, [pathname])
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    const id = requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(id)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <TitleAndScroll />
      <Toasts />
      <OnlineEvents />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/play" element={<Play />} />
        <Route path="/online" element={<Lobby />} />
        <Route path="/game/:id" element={<OnlineGame />} />
        <Route path="/login" element={<Login />} />
        <Route path="/u/:name" element={<Profile />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/:username" element={<Games />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/analysis/pgn/:key" element={<Analysis />} />
        <Route path="/analysis/chesscom/:username/:year/:month/:id" element={<Analysis />} />
        <Route path="/learn" element={<LearnHub />} />
        <Route path="/learn/roadmap" element={<Roadmap />} />
        <Route path="/learn/lessons" element={<LessonsIndex />} />
        <Route path="/learn/lessons/:id" element={<LessonPage />} />
        <Route path="/learn/puzzles" element={<Puzzles />} />
        <Route path="/learn/arcade" element={<Arcade />} />
        <Route path="/learn/badges" element={<BadgesPage />} />
        <Route path="/learn/openings" element={<OpeningsIndex />} />
        <Route path="/learn/openings/:id" element={<OpeningLessonPage />} />
        <Route path="/learn/middlegame" element={<Middlegame />} />
        <Route path="/learn/endgames" element={<EndgamesIndex />} />
        <Route path="/learn/endgames/:id" element={<EndgameDrillPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

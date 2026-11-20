import { Link } from 'react-router-dom'
import { Piece } from '../board/Piece'
import { dayKey, levelOf, streakOf, useGame } from '../learn/game'

/** A flame: the streak. */
export function Flame({ lit }: { lit: boolean }) {
  return (
    <svg className={`flame${lit ? ' flame--lit' : ''}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 1.8c.6 3-1.6 4.3-2.8 6.1C6 9.6 5.2 11 5.2 12.9A4.8 4.8 0 0 0 10 17.8a4.8 4.8 0 0 0 4.8-4.9c0-2.4-1.2-3.9-2.2-5.2.1 1.6-.4 2.7-1.4 3.3.4-3.5-.7-6.5-1.2-9.2z" />
    </svg>
  )
}

/** Today's XP against the goal, as a ring. */
export function GoalRing({ value, goal, size = 28 }: { value: number; goal: number; size?: number }) {
  const r = 15.5
  const c = 2 * Math.PI * r
  const pct = Math.min(1, goal ? value / goal : 0)
  return (
    <svg className={`goal-ring${pct >= 1 ? ' goal-ring--done' : ''}`} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <circle cx="18" cy="18" r={r} className="goal-ring__track" />
      <circle cx="18" cy="18" r={r} className="goal-ring__fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 18 18)" />
    </svg>
  )
}

/** The game strip in the learn bar: rank and level, XP to next, streak, today's goal. */
export function LearnHud() {
  const g = useGame()
  const lv = levelOf(g.xp)
  const today = g.days[dayKey()] ?? 0
  const streak = streakOf(g)
  return (
    <Link to="/learn#profile" className="hud" aria-label={`Level ${lv.level} ${lv.rank.title}, ${lv.toNext} XP to next level, ${streak}-day streak, ${today} of ${g.goal} XP today`}>
      <span className="hud__lvl">
        <span className="hud__piece">
          <Piece type={lv.rank.piece} color="w" />
        </span>
        <span className="mono mono--sm">Lv {lv.level}</span>
      </span>
      <span className="hud__bar" aria-hidden="true">
        <span style={{ width: `${(lv.into / lv.span) * 100}%` }} />
      </span>
      <span className="hud__streak mono mono--sm">
        <Flame lit={today >= g.goal} />
        {streak}
      </span>
      <span className="hud__goal mono mono--sm">
        <GoalRing value={today} goal={g.goal} size={22} />
        {Math.min(today, g.goal)}/{g.goal}
      </span>
    </Link>
  )
}

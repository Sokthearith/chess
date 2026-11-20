import { Link } from 'react-router-dom'
import { Piece } from '../../board/Piece'
import { Footer } from '../../components/Footer'
import { Nav } from '../../components/Nav'
import type { PieceType } from '../../game/types'
import { ENDGAMES } from '../../learn/endgames'
import { LESSONS } from '../../learn/lessons'
import { MOTIFS, MOTIF_GROUPS } from '../../learn/motifs'
import { OPENINGS, OPENING_GROUPS } from '../../learn/openings'
import { useProgress } from '../../learn/progress'
import { useRoadmap } from '../../learn/roadmap'
import { LearnTabs } from './LearnTabs'
import { Flame, GoalRing } from '../../components/LearnHud'
import { GOALS, addDays, dayKey, levelOf, questProgress, questsFor, setGoal, streakOf, useGame } from '../../learn/game'
import { badgeFraction, useBadges } from '../../learn/badges'
import { BadgeCard } from './Badges'
import { Meter } from './Roadmap'

interface Card {
  to: string
  piece: PieceType
  kicker: string
  title: string
  body: string
  /** Progress line, and the meter behind it (null: no meter). */
  stat: string
  meter: [number, number] | null
  cta: string
  links: { to: string; label: string }[]
}

const ENDGAME_LEVELS = [
  { id: 'basic', title: 'Basic mates' },
  { id: 'core', title: 'Must know' },
  { id: 'advanced', title: 'Advanced' },
] as const

const QUICK_PUZZLES = [
  { theme: 'mateIn1', label: 'Mate in 1' },
  { theme: 'mateIn2', label: 'Mate in 2' },
  { theme: 'fork', label: 'Forks' },
  { theme: 'pin', label: 'Pins' },
  { theme: 'hangingPiece', label: 'Hanging pieces' },
]

function TrainerCard({ c }: { c: Card }) {
  return (
    <article className="tcard" aria-labelledby={`tc-${c.title}`}>
      <div className="tcard__top">
        <span className="tcard__icon">
          <Piece type={c.piece} color="w" />
        </span>
        <p className="mono mono--sm mono--mute">{c.kicker}</p>
      </div>
      <h3 id={`tc-${c.title}`} className="tcard__title">
        <Link to={c.to}>{c.title}</Link>
      </h3>
      <p className="tcard__body">{c.body}</p>
      <div className="tcard__stat">
        <p className="mono mono--sm">{c.stat}</p>
        {c.meter ? <Meter value={c.meter[0]} max={c.meter[1]} label={`${c.title} progress`} /> : null}
      </div>
      {c.links.length ? (
        <ul className="chips" aria-label={`${c.title}: jump to`}>
          {c.links.map((l) => (
            <li key={l.to}>
              <Link className="chip" to={l.to}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link className="btn btn--quiet btn--sm tcard__cta" to={c.to}>
        {c.cta}
      </Link>
    </article>
  )
}

/**
 * The learning index, in three bands: where you are on the roadmap, the two
 * things to do every day (lessons, puzzles), and the three phases of the game.
 */
export function LearnHub() {
  const [p] = useProgress()
  const road = useRoadmap()
  const learned = Object.keys(p.openings).length
  const mastered = Object.values(p.openings).filter((v) => v === 'mastered').length
  const nextStageIndex = road.next ? road.stages.findIndex((s) => s.stage.id === road.next!.stage.id) : -1

  const daily: Card[] = [
    {
      to: '/learn/lessons',
      piece: 'r',
      kicker: 'Start here',
      title: 'Lessons',
      body: `${LESSONS.length} guided lessons, one idea at a time: how the pieces move, special moves, piece values, opening principles, the blunder check, mating patterns, the opposition, classic sacrifices.`,
      stat: `Done — ${p.lessons.length} of ${LESSONS.length}`,
      meter: [p.lessons.length, LESSONS.length],
      cta: 'Open lessons',
      links: road.stages.map((s, i) => ({ to: `/learn/lessons#ls-${s.stage.id}`, label: `${i + 1}. ${s.stage.title}` })),
    },
    {
      to: '/learn/puzzles',
      piece: 'q',
      kicker: 'Every day',
      title: 'Puzzles',
      body: 'Real positions from real games, matched to your rating. Find the move that wins; your puzzle rating follows how you do.',
      stat: `Rating — ${p.puzzleRating} · solved — ${p.solved.length} · best streak — ${p.bestStreak}`,
      meter: null,
      cta: 'Mixed puzzles',
      links: QUICK_PUZZLES.map((q) => ({ to: `/learn/puzzles?theme=${q.theme}`, label: q.label })),
    },
  ]

  const phases: Card[] = [
    {
      to: '/learn/openings',
      piece: 'p',
      kicker: 'Phase 1 — the opening',
      title: 'Openings',
      body: `${OPENINGS.length} main lines with the reason for every move. Learn one with the arrows on, then play it from memory.`,
      stat: `Learned — ${learned} of ${OPENINGS.length} · mastered — ${mastered}`,
      meter: [learned, OPENINGS.length],
      cta: 'All openings',
      links: OPENING_GROUPS.map((g) => ({ to: `/learn/openings#g-${g.id}`, label: g.title })),
    },
    {
      to: '/learn/middlegame',
      piece: 'n',
      kicker: 'Phase 2 — the middlegame',
      title: 'Middlegame',
      body: `${MOTIFS.length} tactical motifs and mating patterns. Read the idea, then train it on positions where it decides the game.`,
      stat: `Motifs — ${MOTIFS.length} in ${MOTIF_GROUPS.length} groups`,
      meter: null,
      cta: 'All motifs',
      links: MOTIF_GROUPS.map((g) => ({ to: `/learn/middlegame#m-${g.id}`, label: g.title })),
    },
    {
      to: '/learn/endgames',
      piece: 'k',
      kicker: 'Phase 3 — the endgame',
      title: 'Endgames',
      body: 'The positions every player must know, played out against Stockfish at full strength: basic mates, king and pawn, Lucena and Philidor.',
      stat: `Completed — ${p.endgames.length} of ${ENDGAMES.length}`,
      meter: [p.endgames.length, ENDGAMES.length],
      cta: 'All endgames',
      links: ENDGAME_LEVELS.map((l) => ({ to: `/learn/endgames#e-${l.id}`, label: l.title })),
    },
  ]


  return (
    <>
      <Nav />
      <LearnTabs />
      <main id="main" className="container learn">
        <header className="learn__head">
          <h1>Learn</h1>
          <p className="lead">Follow the roadmap from your first move to the endings masters play, or go straight to a trainer. Earn XP, keep your streak, climb from Pawn to King. Progress stays in this browser.</p>
        </header>

        <PlayerBand />

        <section className="roadcard on-ink" aria-labelledby="rc-title">
          <div className="roadcard__text">
            <p className="mono mono--sm mono--mute">
              {road.next ? `Up next — stage ${nextStageIndex + 1} of ${road.stages.length}, ${road.next.stage.title.toLowerCase()}` : 'Roadmap — complete'}
            </p>
            <h2 id="rc-title" className="roadcard__title">
              {road.next ? road.next.step.title : 'Every step done'}
            </h2>
            <p className="roadcard__body">
              {road.next
                ? `${road.next.step.kind}: ${road.next.step.body}`
                : 'Keep your puzzle rating climbing and replay the endings against Stockfish.'}
            </p>
            <div className="play__controls">
              {road.next ? (
                <Link className="btn" to={road.next.step.to}>
                  {road.done ? 'Continue' : 'Start'}
                </Link>
              ) : null}
              <Link className="btn btn--quiet" to="/learn/roadmap">
                Full roadmap
              </Link>
            </div>
          </div>
          <ol className="roadcard__stages" aria-label="Roadmap stages">
            {road.stages.map(({ stage, steps, done }, i) => (
              <li key={stage.id}>
                <Link to={`/learn/roadmap#st-${stage.id}`} className={`rstage${i === nextStageIndex ? ' rstage--now' : ''}`} aria-current={i === nextStageIndex ? 'step' : undefined}>
                  <span className="rstage__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="rstage__text">
                    <span className="rstage__title">{stage.title}</span>
                    <span className="mono mono--sm mono--mute">
                      {stage.band} · {done} of {steps.length}
                    </span>
                  </span>
                  <Meter value={done} max={steps.length} label={`${stage.title} progress`} />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <ArcadeBand />

        <section className="hubsec" aria-labelledby="hub-daily">
          <div className="shelf__head">
            <h2 id="hub-daily">Learn and practise</h2>
            <p className="mono mono--sm mono--mute">Lessons teach the rule; puzzles make it a habit</p>
          </div>
          <div className="tcards tcards--two">
            {daily.map((c) => (
              <TrainerCard key={c.to} c={c} />
            ))}
          </div>
        </section>

        <section className="hubsec" aria-labelledby="hub-phases">
          <div className="shelf__head">
            <h2 id="hub-phases">By phase of the game</h2>
            <p className="mono mono--sm mono--mute">Opening, middlegame, endgame</p>
          </div>
          <div className="tcards tcards--three">
            {phases.map((c) => (
              <TrainerCard key={c.to} c={c} />
            ))}
          </div>
        </section>
        <BadgeStrip />
      </main>
      <Footer />
    </>
  )
}

/** Rank and level, today's goal and streak, and the day's three quests. */
function PlayerBand() {
  const g = useGame()
  const [p] = useProgress()
  const lv = levelOf(g.xp)
  const today = dayKey()
  const todayXp = g.days[today] ?? 0
  const streak = streakOf(g)
  const quests = questsFor(today, g.goal)
  const claimed = new Set(g.claimed[today] ?? [])
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })
  return (
    <section id="profile" className="player-band" aria-label="Your progress">
      <article className="pcard pcard--rank">
        <div className="pcard__rank">
          <span className="medal medal--big" aria-hidden="true">
            <Piece type={lv.rank.piece} color="w" />
          </span>
          <div>
            <p className="mono mono--sm mono--mute">Rank — {lv.rank.title}</p>
            <h2 className="pcard__level">Level {lv.level}</h2>
          </div>
        </div>
        <div className="pcard__xp">
          <span className="xpbar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={lv.span} aria-valuenow={lv.into}>
            <span style={{ width: `${(lv.into / lv.span) * 100}%` }} />
          </span>
          <p className="mono mono--sm">
            {lv.into} / {lv.span} XP <span className="mono--mute">· {lv.toNext} to level {lv.level + 1}</span>
          </p>
        </div>
        <p className="mono mono--sm mono--mute">
          {g.xp} XP in all · puzzle rating {p.puzzleRating}
        </p>
      </article>

      <article className="pcard pcard--today">
        <div className="pcard__today">
          <span className="pcard__ring">
            <GoalRing value={todayXp} goal={g.goal} size={88} />
            <span className="pcard__ring-n">
              {Math.min(todayXp, g.goal)}
              <span className="mono mono--sm mono--mute">/{g.goal}</span>
            </span>
          </span>
          <div className="pcard__streak">
            <p className="pcard__streak-n">
              <Flame lit={todayXp >= g.goal} />
              {streak}
              <span className="mono mono--sm mono--mute"> day streak</span>
            </p>
            <ol className="week" aria-label="The last seven days">
              {week.map((d) => {
                const met = (g.days[d] ?? 0) >= g.goal
                const frozen = g.frozen.includes(d)
                return (
                  <li key={d} className={`week__day${met ? ' week__day--met' : frozen ? ' week__day--frozen' : ''}${d === today ? ' week__day--today' : ''}`} title={`${d}: ${g.days[d] ?? 0} XP${frozen ? ', frozen' : ''}`}>
                    <span className="week__dot" />
                    <span className="mono mono--sm">{dayName(d)}</span>
                  </li>
                )
              })}
            </ol>
            <p className="mono mono--sm mono--mute">
              {g.freezes} streak freeze{g.freezes === 1 ? '' : 's'} · one more every 7 days
            </p>
          </div>
        </div>
        <fieldset className="goalpick">
          <legend className="mono mono--sm">Daily goal</legend>
          {GOALS.map((x) => (
            <label key={x.xp} className={`goalpick__opt${g.goal === x.xp ? ' goalpick__opt--on' : ''}`}>
              <input type="radio" name="goal" className="visually-hidden" checked={g.goal === x.xp} onChange={() => setGoal(x.xp)} />
              {x.name} <span className="mono--mute">{x.xp}</span>
            </label>
          ))}
        </fieldset>
      </article>

      <article className="pcard pcard--quests" aria-labelledby="q-head">
        <div className="pcard__head">
          <h2 id="q-head" className="pcard__title">
            Daily quests
          </h2>
          <span className="mono mono--sm mono--mute">New quests at midnight</span>
        </div>
        <ul className="quests">
          {quests.map((q) => {
            const v = questProgress(g, q)
            const done = claimed.has(q.id) || v >= q.target
            return (
              <li key={q.id} className={`quest${done ? ' quest--done' : ''}`}>
                <span className="quest__check" aria-hidden="true">
                  {done ? '✓' : ''}
                </span>
                <span className="quest__body">
                  <span className="quest__title">{q.title}</span>
                  <span className="quest__bar" aria-hidden="true">
                    <span style={{ width: `${(v / q.target) * 100}%` }} />
                  </span>
                </span>
                <span className="quest__xp mono mono--sm">
                  {done ? 'done' : `${v}/${q.target}`}
                  <span className="mono--mute"> +{q.xp}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mono mono--sm mono--mute">All three: +25 XP bonus</p>
      </article>
    </section>
  )
}

/** The two fast modes, with personal bests. */
function ArcadeBand() {
  const g = useGame()
  return (
    <section className="hubsec" aria-labelledby="hub-arcade">
      <div className="shelf__head">
        <h2 id="hub-arcade">Arcade</h2>
        <p className="mono mono--sm mono--mute">Unrated speed modes — beat your best</p>
      </div>
      <div className="tcards tcards--two">
        <Link to="/learn/arcade" className="amode amode--link">
          <p className="mono mono--sm mono--mute">3:00 on the clock</p>
          <span className="amode__title">Puzzle Rush</span>
          <span className="amode__blurb">Solve as many as you can. Combos buy time, misses cost ten seconds.</span>
          <span className="amode__foot">
            <span>
              <span className="mono mono--sm mono--mute">Best</span>
              <span className="amode__best">{g.best.rushBest ?? 0}</span>
            </span>
            <span className="btn btn--sm">Play</span>
          </span>
        </Link>
        <Link to="/learn/arcade" className="amode amode--link">
          <p className="mono mono--sm mono--mute">Sudden death</p>
          <span className="amode__title">Puzzle Streak</span>
          <span className="amode__blurb">Each puzzle harder than the last. One mistake ends it.</span>
          <span className="amode__foot">
            <span>
              <span className="mono mono--sm mono--mute">Best</span>
              <span className="amode__best">{g.best.streakBest ?? 0}</span>
            </span>
            <span className="btn btn--sm">Play</span>
          </span>
        </Link>
      </div>
    </section>
  )
}

/** Latest badges earned, and the ones closest to earning. */
function BadgeStrip() {
  const views = useBadges()
  const earned = views.filter((v) => v.earned).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
  const close = views
    .filter((v) => !v.earned)
    .sort((a, b) => badgeFraction(b) - badgeFraction(a))
    .slice(0, 4 - Math.min(2, earned.length))
  const shown = [...earned.slice(0, 2), ...close]
  return (
    <section className="hubsec" aria-labelledby="hub-badges">
      <div className="shelf__head">
        <h2 id="hub-badges">Badges</h2>
        <p className="mono mono--sm mono--mute">
          {earned.length} of {views.length} — <Link to="/learn/badges">see all</Link>
        </p>
      </div>
      <ul className="badge-grid">
        {shown.map((v) => (
          <BadgeCard key={v.badge.id} v={v} />
        ))}
      </ul>
    </section>
  )
}

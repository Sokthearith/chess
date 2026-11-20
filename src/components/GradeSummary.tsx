import { JUDGEMENTS, JUDGEMENT_WORD, summarise, type MoveReview } from '../analysis/review'
import { GradeIcon } from '../board/GradeIcon'

interface Props {
  graded: MoveReview[]
  white: string
  black: string
  /** True while the review is still running: the counts are provisional. */
  running: boolean
}

const LABEL: Record<(typeof JUDGEMENTS)[number], string> = {
  brilliant: 'Brilliant',
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  miss: 'Miss',
  blunder: 'Blunder',
}

/** The per-player tally of every grade, Chess.com's review table set as a poster table. */
export function GradeSummary({ graded, white, black, running }: Props) {
  const done = graded.filter(Boolean)
  const w = summarise(done, 'w')
  const b = summarise(done, 'b')
  return (
    <section className="tally" aria-labelledby="tally-head">
      <div className="tally__head">
        <h2 id="tally-head">Game review</h2>
        <p className="mono mono--sm mono--mute">{running ? `Grading — ${done.length} moves so far` : `${done.length} moves graded`}</p>
      </div>
      <table className="tally__table">
        <caption className="visually-hidden">Moves by grade for each player</caption>
        <thead>
          <tr>
            <th scope="col" className="tally__side mono">{white}</th>
            <th scope="col" className="mono mono--mute">Grade</th>
            <th scope="col" className="tally__side mono">{black}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="tally__acc">
            <td className="tally__n">{done.length ? Math.round(w.accuracy) : '—'}</td>
            <th scope="row" className="mono">Accuracy</th>
            <td className="tally__n">{done.length ? Math.round(b.accuracy) : '—'}</td>
          </tr>
          {JUDGEMENTS.map((j) => (
            <tr key={j} className={`tally__row tally__row--${j}${w[j] + b[j] === 0 ? ' tally__row--zero' : ''}`}>
              <td className="tally__n">{w[j]}</td>
              <th scope="row">
                <span className="tally__grade">
                  <GradeIcon kind={j} />
                  <span>{LABEL[j]}</span>
                  <span className="visually-hidden"> ({JUDGEMENT_WORD[j]})</span>
                </span>
              </th>
              <td className="tally__n">{b[j]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

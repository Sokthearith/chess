import { Chess } from 'chess.js'
import { useEffect, useRef, useState } from 'react'
import { createEngine, type EngineAdapter } from '../engine'
import type { MoveIntent } from './types'

/**
 * The computer opponent. Eight levels, from "plays almost at random" to full
 * Stockfish. Low levels mix Stockfish's weakest skill setting with a share of
 * random legal moves, because Skill Level 0 on its own still beats most
 * beginners.
 */
export interface Level {
  level: number
  name: string
  note: string
  skill: number
  depth?: number
  movetime?: number
  /** Share of moves picked at random from the legal ones. */
  random: number
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Newcomer', note: 'Hangs pieces, misses mates. For your first games.', skill: 0, depth: 1, random: 0.5 },
  { level: 2, name: 'Casual', note: 'Sees one-move threats, often not two.', skill: 0, depth: 2, random: 0.25 },
  { level: 3, name: 'Learner', note: 'Takes free pieces, falls for simple tactics.', skill: 2, depth: 3, random: 0.08 },
  { level: 4, name: 'Club', note: 'Solid enough to punish a blunder.', skill: 5, depth: 5, random: 0 },
  { level: 5, name: 'Strong club', note: 'Plays sound chess; you need a plan.', skill: 9, depth: 8, random: 0 },
  { level: 6, name: 'Expert', note: 'Few mistakes. Tactics come back at you.', skill: 13, depth: 10, random: 0 },
  { level: 7, name: 'Master', note: 'Very strong. Think before every move.', skill: 17, movetime: 600, random: 0 },
  { level: 8, name: 'Stockfish', note: 'Full strength. Good luck.', skill: 20, movetime: 1500, random: 0 },
]

export const levelOf = (n: number) => LEVELS.find((l) => l.level === n) ?? LEVELS[2]

function randomMove(fen: string): MoveIntent | null {
  const moves = new Chess(fen).moves({ verbose: true })
  if (!moves.length) return null
  const m = moves[Math.floor(Math.random() * moves.length)]
  return { from: m.from, to: m.to, promotion: m.promotion as MoveIntent['promotion'] }
}

const fromUci = (uci: string): MoveIntent => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as MoveIntent['promotion']) || undefined })

/**
 * While `active`, think about `fen` and hand back one move through `onMove`.
 * It waits at least `minDelay` so a fast reply does not feel like a reflex.
 * With no engine available it plays random legal moves and says so.
 */
export function useComputer(fen: string, active: boolean, level: number, onMove: (m: MoveIntent) => void, minDelay = 450) {
  const engine = useRef<EngineAdapter | null>(null)
  const [thinking, setThinking] = useState(false)
  const [fallback, setFallback] = useState(false)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    const e = createEngine()
    engine.current = e
    if (e.name === 'none') setFallback(true)
    e.init().catch(() => setFallback(true))
    return () => e.dispose()
  }, [])

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const l = levelOf(level)
    const started = performance.now()
    setThinking(true)
    const finish = (m: MoveIntent | null) => {
      if (controller.signal.aborted || !m) return
      const wait = Math.max(0, minDelay - (performance.now() - started))
      window.setTimeout(() => {
        if (controller.signal.aborted) return
        setThinking(false)
        onMoveRef.current(m)
      }, wait)
    }
    if (Math.random() < l.random || !engine.current) {
      finish(randomMove(fen))
    } else {
      engine.current
        .analyse(fen, { skill: l.skill, depth: l.depth, movetime: l.movetime, signal: controller.signal })
        .then((ev) => {
          if (ev?.bestMove && ev.bestMove !== '(none)') finish(fromUci(ev.bestMove))
          else {
            if (!controller.signal.aborted) setFallback(true)
            finish(randomMove(fen))
          }
        })
        .catch(() => {
          setFallback(true)
          finish(randomMove(fen))
        })
    }
    return () => {
      controller.abort()
      setThinking(false)
    }
  }, [fen, active, level, minDelay])

  return { thinking, fallback }
}

import { useEffect, useRef, useState } from 'react'
import { createEngine, type EngineAdapter, type Evaluation } from '../engine'

const DEPTH = 16

/**
 * Stockfish on demand for positions the review never saw (the user's own
 * variations). One worker, started the first time it is needed; every answer
 * is kept by FEN, so stepping back and forth through a line is instant.
 */
export function useLiveEval(fen: string, enabled: boolean) {
  const engine = useRef<EngineAdapter | null>(null)
  const cache = useRef(new Map<string, Evaluation | null>())
  const [, bump] = useState(0)
  const [thinking, setThinking] = useState(false)

  useEffect(() => () => engine.current?.dispose(), [])

  useEffect(() => {
    if (!enabled || cache.current.has(fen)) {
      setThinking(false)
      return
    }
    engine.current ??= createEngine()
    const e = engine.current
    const controller = new AbortController()
    setThinking(true)
    // A short pause so walking through a line with the arrows does not start a search per step.
    const t = window.setTimeout(() => {
      e.analyse(fen, { depth: DEPTH, multiPv: 2, signal: controller.signal })
        .then((ev) => {
          if (controller.signal.aborted) return
          cache.current.set(fen, ev)
          setThinking(false)
          bump((n) => n + 1)
        })
        .catch(() => setThinking(false))
    }, 140)
    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [fen, enabled])

  return {
    evaluation: cache.current.get(fen) ?? null,
    thinking,
    /** Any position analysed so far. */
    lookup: (f: string) => cache.current.get(f),
  }
}

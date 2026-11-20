import { useEffect, useRef, useState } from 'react'
import { createEngine, type EngineAdapter, type Evaluation } from './index'

/** Debounced evaluation of the current FEN. Falls back to "no opinion" on any failure. */
export function useEngine(fen: string, enabled = true) {
  const engineRef = useRef<EngineAdapter | null>(null)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [name, setName] = useState('none')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  useEffect(() => {
    const engine = createEngine()
    engineRef.current = engine
    setName(engine.name)
    setStatus(engine.name === 'none' ? 'idle' : 'loading')
    engine
      .init()
      .then(() => setStatus(engine.name === 'none' ? 'idle' : 'ready'))
      .catch(() => {
        setName('none')
        setStatus('failed')
      })
    return () => engine.dispose()
  }, [])

  useEffect(() => {
    if (!enabled) return
    const engine = engineRef.current
    if (!engine) return
    const controller = new AbortController()
    const t = window.setTimeout(() => {
      engine
        .analyse(fen, { depth: 12, signal: controller.signal })
        .then((ev) => {
          if (!controller.signal.aborted) setEvaluation(ev)
        })
        .catch(() => setEvaluation(null))
    }, 120)
    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [fen, enabled])

  return { evaluation, engineName: name, engineStatus: status }
}

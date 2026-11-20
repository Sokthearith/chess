import type { EngineAdapter } from './EngineAdapter'
import { NullEngine } from './NullEngine'
import { StockfishWorkerEngine } from './StockfishWorkerEngine'

export type { EngineAdapter, Evaluation, AnalyseOptions, Score } from './EngineAdapter'
export { evaluationToShare, formatEvaluation } from './EngineAdapter'
export { NullEngine } from './NullEngine'
export { StockfishWorkerEngine } from './StockfishWorkerEngine'

/** One place decides which engine runs. The UI only ever sees the interface. */
export function createEngine(): EngineAdapter {
  const url = import.meta.env.VITE_ENGINE_WORKER as string | undefined
  if (url) return new StockfishWorkerEngine(url)
  return new NullEngine()
}

import type { EngineAdapter, Evaluation } from './EngineAdapter'

/** The placeholder. Always "no opinion", so the bar sits at even with its red mark. */
export class NullEngine implements EngineAdapter {
  readonly name = 'none'
  async init(): Promise<void> {}
  async analyse(): Promise<Evaluation | null> {
    return null
  }
  stop(): void {}
  dispose(): void {}
}

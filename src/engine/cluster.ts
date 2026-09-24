/**
 * Cluster execution: run one command concurrently across selected hosts; the
 * caller must provide at least one non-empty aliases / environment / tags filter.
 */

import type { ClusterResult } from '../protocol.ts'
import { execCommand, type PoolEngine } from './connection-pool.ts'

interface ClusterOptions {
  command: string
  aliases?: string[]
  environment?: string
  tags?: string[]
  timeoutMs?: number
  maxWorkers?: number
}

/** Run one command against many hosts concurrently. */
export async function cluster(engine: PoolEngine, options: ClusterOptions): Promise<ClusterResult[]> {
  const hasAliases = Array.isArray(options.aliases) && options.aliases.some(alias => typeof alias === 'string' && alias.trim() !== '')
  const hasEnvironment = typeof options.environment === 'string' && options.environment.trim() !== ''
  const hasTags = Array.isArray(options.tags) && options.tags.some(tag => typeof tag === 'string' && tag.trim() !== '')
  if (!hasAliases && !hasEnvironment && !hasTags) {
    throw new Error('ssh_cluster requires aliases, environment, or tags to limit the target set')
  }

  const all = engine.store.list()
  let targets = all
  // Aliases the caller named but the store does not know: surface each as a
  // failed row instead of silently dropping it, so a typo never reads as
  // "every host succeeded".
  const missing: ClusterResult[] = []
  if (options.aliases !== undefined && options.aliases.length > 0) {
    const requested = [...new Set(options.aliases.filter(alias => typeof alias === 'string').map(alias => alias.trim()).filter(alias => alias !== ''))]
    const known = new Set(all.map(entry => entry.alias))
    for (const alias of requested) {
      if (!known.has(alias)) missing.push({ alias, ok: false, error: 'alias \'' + alias + '\' not found — add it first' })
    }
    targets = targets.filter(entry => requested.includes(entry.alias))
  }
  if (options.environment !== undefined && options.environment !== '') {
    targets = targets.filter(entry => entry.environment === options.environment)
  }
  if (options.tags !== undefined && options.tags.length > 0) {
    // ALL semantics (matches the ssh_cluster tool description).
    targets = targets.filter(entry => options.tags!.every(tag => entry.tags.includes(tag)))
  }
  if (options.maxWorkers !== undefined && (!Number.isInteger(options.maxWorkers) || options.maxWorkers < 1)) {
    throw new Error('maxWorkers must be a positive integer')
  }
  if (targets.length === 0) return missing
  const workers = Math.min(engine.opts.defaultMaxWorkers, options.maxWorkers ?? engine.opts.defaultMaxWorkers, targets.length)
  const results: ClusterResult[] = [...missing]
  const queue = [...targets]
  const run = async (): Promise<void> => {
    while (queue.length > 0) {
      const entry = queue.shift()!
      try {
        const result = await execCommand(engine, entry.alias, options.command, options.timeoutMs)
        results.push({ alias: entry.alias, ok: result.success, exitCode: result.exitCode, timedOut: result.timedOut, stdout: result.stdout, stderr: result.stderr, durationMs: result.durationMs })
      } catch (error) {
        results.push({ alias: entry.alias, ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, () => run()))
  return results
}
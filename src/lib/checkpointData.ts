import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BaseModel, CheckpointDataset, Family, LearningRate, MetricMap, MetricValue, Run, TaskKey } from '@/lib/checkpointTypes'

const TASKS: TaskKey[] = ['ChemHotpotQARetrieval', 'ChemNQRetrieval', 'ChemRxivRetrieval']
const EPOCHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const RESULTS_ROOT = path.join(process.cwd(), 'results', 'checkpoint-data')

const SERIES: Array<{ family: Family; lr: LearningRate }> = [
  { family: 'vanilla', lr: '1e-6' },
  { family: 'vanilla', lr: '1e-5' },
  { family: 'full', lr: '1e-5' },
  { family: 'full', lr: '1e-6' },
  { family: 'plug', lr: '1e-5' },
  { family: 'plug', lr: '1e-6' },
  { family: 'prog1', lr: '1e-5' },
]

type TaskPayload = {
  task_name?: string
  scores?: {
    test?: Array<Record<string, unknown>> | Record<string, unknown>
  }
}

type ModelMeta = {
  name?: string
}

function parseLooseJson<T>(text: string): T {
  return JSON.parse(text.replace(/\bNaN\b/g, 'null')) as T
}

function sanitizeMetricValue(value: unknown): MetricValue {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return null
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  return null
}

function extractMetricRow(payload: TaskPayload): Record<string, unknown> {
  const scores = payload.scores?.test
  if (Array.isArray(scores)) {
    const first = scores[0]
    return first && typeof first === 'object' ? first : {}
  }
  if (scores && typeof scores === 'object') return scores
  return {}
}

function sanitizeMetricRow(row: Record<string, unknown>): MetricMap {
  const out: MetricMap = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = sanitizeMetricValue(value)
  }
  return out
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8')
  return parseLooseJson<T>(raw)
}

async function readTaskMetrics(dirPath: string, task: TaskKey): Promise<MetricMap> {
  const payload = await readJson<TaskPayload>(path.join(dirPath, `${task}.json`))
  return sanitizeMetricRow(extractMetricRow(payload))
}

async function readTasks(dirPath: string): Promise<Record<TaskKey, MetricMap>> {
  const entries = await Promise.all(TASKS.map(async (task) => [task, await readTaskMetrics(dirPath, task)] as const))
  return Object.fromEntries(entries) as Record<TaskKey, MetricMap>
}

async function readModelLabel(dirPath: string): Promise<string> {
  const meta = await readJson<ModelMeta>(path.join(dirPath, 'model_meta.json'))
  return typeof meta.name === 'string' ? meta.name : path.basename(dirPath)
}

export async function loadCheckpointData(): Promise<CheckpointDataset> {
  const baseDir = path.join(RESULTS_ROOT, 'base')
  const baseModel: BaseModel = {
    id: 'base',
    label: await readModelLabel(baseDir),
    tasks: await readTasks(baseDir),
  }

  const runs: Run[] = []
  for (const { family, lr } of SERIES) {
    for (const epoch of EPOCHS) {
      const runDir = path.join(RESULTS_ROOT, family, lr, `epoch-${epoch}`)
      runs.push({
        id: `${family}-${lr}-ep${epoch}`,
        family,
        lr,
        epoch,
        tasks: await readTasks(runDir),
      })
    }
  }

  return { baseModel, runs }
}

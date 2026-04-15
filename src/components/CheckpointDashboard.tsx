'use client'

import { useMemo, useState } from 'react'
import type { BaseModel, Family, LearningRate, Run, TaskKey } from '@/lib/checkpointTypes'

type MetricOption = { key: string; label: string }

type Series = {
  key: string
  family: Family
  lr: LearningRate
  label: string
  color: string
  dash: string | undefined
  runs: Run[]
}

type CheckpointDashboardProps = {
  baseModel: BaseModel
  runs: Run[]
}

const TASK_LABELS: Record<TaskKey, string> = {
  ChemHotpotQARetrieval: 'ChemHotpotQA',
  ChemNQRetrieval: 'ChemNQ',
  ChemRxivRetrieval: 'ChemRxiv',
}

const FAMILY_LABELS: Record<Family, string> = {
  vanilla: 'Vanilla',
  full: 'Full',
  plug: 'Plug',
}

const FAMILY_COLORS: Record<Family, string> = {
  vanilla: '#60a5fa',
  full: '#f59e0b',
  plug: '#34d399',
}

const TASKS: TaskKey[] = ['ChemHotpotQARetrieval', 'ChemNQRetrieval', 'ChemRxivRetrieval']

function metricOptions(baseModel: BaseModel): MetricOption[] {
  const sample = baseModel.tasks.ChemRxivRetrieval
  const out: MetricOption[] = []
  if ('mrr_at_10' in sample) out.push({ key: 'mrr_at_10', label: 'MRR@10' })
  if ('ndcg_at_10' in sample) out.push({ key: 'ndcg_at_10', label: 'NDCG@10' })
  if ('precision_at_1' in sample) out.push({ key: 'precision_at_1', label: 'HitRate@1' })
  else if ('hitrate_at_1' in sample) out.push({ key: 'hitrate_at_1', label: 'HitRate@1' })
  return out
}

function valueFor(run: Run | BaseModel, task: TaskKey, metric: string) {
  const taskMetrics = run.tasks[task] as Record<string, unknown>
  const value = taskMetrics[metric]
  return typeof value === 'number' ? value : 0
}

function formatMetric(value: number) {
  return value.toFixed(3)
}

function buildSeries(runs: Run[]): Series[] {
  const grouped = new Map<string, Series>()
  for (const run of runs) {
    const key = `${run.family}-${run.lr}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        family: run.family,
        lr: run.lr,
        label: `${FAMILY_LABELS[run.family]} · ${run.lr}`,
        color: FAMILY_COLORS[run.family],
        dash: run.lr === '1e-5' ? '6 4' : undefined,
        runs: [],
      })
    }
    grouped.get(key)!.runs.push(run)
  }
  return Array.from(grouped.values()).map((series) => ({
    ...series,
    runs: [...series.runs].sort((a, b) => a.epoch - b.epoch),
  }))
}

function svgPath(points: Array<{ x: number; y: number }>) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

function scale(value: number, min: number, max: number, outMin: number, outMax: number) {
  if (max === min) return (outMin + outMax) / 2
  return outMin + ((value - min) / (max - min)) * (outMax - outMin)
}

function extent(values: number[], pad = 0.02) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 0.01
  return [min - span * pad, max + span * pad] as const
}

function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm shadow-black/20">
      <div className="text-xs uppercase tracking-[0.14em] text-neutral-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {note ? <div className="mt-1 text-xs text-neutral-500">{note}</div> : null}
    </div>
  )
}

function ScatterTradeoff({ baseModel, series, metric, visible }: { baseModel: BaseModel; series: Series[]; metric: string; visible: Set<string> }) {
  const margin = { top: 20, right: 24, bottom: 48, left: 56 }
  const width = 760
  const height = 420
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  const visibleSeries = series.filter((s) => visible.has(s.key))
  const points = visibleSeries.flatMap((s) =>
    s.runs.map((run) => ({
      x: (valueFor(run, 'ChemHotpotQARetrieval', metric) + valueFor(run, 'ChemNQRetrieval', metric)) / 2,
      y: valueFor(run, 'ChemRxivRetrieval', metric),
    }))
  )
  const basePoint = {
    x: (valueFor(baseModel, 'ChemHotpotQARetrieval', metric) + valueFor(baseModel, 'ChemNQRetrieval', metric)) / 2,
    y: valueFor(baseModel, 'ChemRxivRetrieval', metric),
  }
  const [xMin, xMax] = extent([...points.map((p) => p.x), basePoint.x])
  const [yMin, yMax] = extent([...points.map((p) => p.y), basePoint.y])

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Tradeoff view</h2>
          <p className="text-sm text-neutral-400">x = average of ChemHotpotQA and ChemNQ, y = ChemRxiv. Points are checkpoints, connected by epoch.</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#3f3f46" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#3f3f46" />

        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const xv = xMin + (xMax - xMin) * t
          const x = scale(xv, xMin, xMax, margin.left, margin.left + plotW)
          const y = margin.top + plotH
          return (
            <g key={`x-${i}`}>
              <line x1={x} y1={margin.top} x2={x} y2={margin.top + plotH} stroke="#262626" strokeDasharray="3 6" />
              <text x={x} y={y + 18} textAnchor="middle" className="fill-neutral-500 text-[11px]">{xv.toFixed(3)}</text>
            </g>
          )
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const yv = yMin + (yMax - yMin) * t
          const y = scale(yv, yMin, yMax, margin.top + plotH, margin.top)
          return (
            <g key={`y-${i}`}>
              <line x1={margin.left} y1={y} x2={margin.left + plotW} y2={y} stroke="#262626" strokeDasharray="3 6" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" className="fill-neutral-500 text-[11px]">{yv.toFixed(3)}</text>
            </g>
          )
        })}

        {visibleSeries.map((s) => {
          const pts = s.runs.map((run) => ({
            run,
            x: scale((valueFor(run, 'ChemHotpotQARetrieval', metric) + valueFor(run, 'ChemNQRetrieval', metric)) / 2, xMin, xMax, margin.left, margin.left + plotW),
            y: scale(valueFor(run, 'ChemRxivRetrieval', metric), yMin, yMax, margin.top + plotH, margin.top),
          }))
          return (
            <g key={s.key}>
              <path d={svgPath(pts)} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash} opacity={0.9} />
              {pts.map((p) => (
                <g key={p.run.id}>
                  <circle cx={p.x} cy={p.y} r={5} fill={s.color} stroke="#0a0a0a" strokeWidth={1.5}>
                    <title>{`${s.label}\nEpoch ${p.run.epoch}\nGeneral avg: ${(((valueFor(p.run, 'ChemHotpotQARetrieval', metric) + valueFor(p.run, 'ChemNQRetrieval', metric)) / 2)).toFixed(3)}\nChemRxiv: ${valueFor(p.run, 'ChemRxivRetrieval', metric).toFixed(3)}`}</title>
                  </circle>
                  <text x={p.x + 7} y={p.y - 7} className="fill-neutral-400 text-[10px]">{p.run.epoch}</text>
                </g>
              ))}
            </g>
          )
        })}

        <g>
          <circle
            cx={scale(basePoint.x, xMin, xMax, margin.left, margin.left + plotW)}
            cy={scale(basePoint.y, yMin, yMax, margin.top + plotH, margin.top)}
            r={7}
            fill="#ffffff"
            stroke="#0a0a0a"
            strokeWidth={2}
          >
            <title>{`Base model\nGeneral avg: ${basePoint.x.toFixed(3)}\nChemRxiv: ${basePoint.y.toFixed(3)}`}</title>
          </circle>
          <text
            x={scale(basePoint.x, xMin, xMax, margin.left, margin.left + plotW) + 10}
            y={scale(basePoint.y, yMin, yMax, margin.top + plotH, margin.top) + 4}
            className="fill-white text-[11px]"
          >
            Base
          </text>
        </g>

        <text x={margin.left + plotW / 2} y={height - 8} textAnchor="middle" className="fill-neutral-400 text-xs">
          General average ({TASK_LABELS.ChemHotpotQARetrieval} + {TASK_LABELS.ChemNQRetrieval}) / 2
        </text>
        <text transform={`translate(14 ${margin.top + plotH / 2}) rotate(-90)`} textAnchor="middle" className="fill-neutral-400 text-xs">
          {TASK_LABELS.ChemRxivRetrieval}
        </text>
      </svg>
    </div>
  )
}

function TaskLineChart({ baseModel, task, metric, series, visible }: { baseModel: BaseModel; task: TaskKey; metric: string; series: Series[]; visible: Set<string> }) {
  const margin = { top: 18, right: 18, bottom: 32, left: 42 }
  const width = 420
  const height = 280
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const visibleSeries = series.filter((s) => visible.has(s.key))
  const values = visibleSeries.flatMap((s) => s.runs.map((run) => valueFor(run, task, metric)))
  const base = valueFor(baseModel, task, metric)
  const [yMin, yMax] = extent([...values, base])

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-white">{TASK_LABELS[task]}</h3>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="#3f3f46" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="#3f3f46" />
        {[0, 1, 2, 3, 4, 5].map((epoch) => {
          const x = scale(epoch, 0, 5, margin.left, margin.left + plotW)
          return (
            <g key={epoch}>
              <line x1={x} y1={margin.top} x2={x} y2={margin.top + plotH} stroke="#262626" strokeDasharray="3 6" />
              <text x={x} y={margin.top + plotH + 18} textAnchor="middle" className="fill-neutral-500 text-[11px]">
                {epoch === 0 ? 'Base' : epoch}
              </text>
            </g>
          )
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const yv = yMin + (yMax - yMin) * t
          const y = scale(yv, yMin, yMax, margin.top + plotH, margin.top)
          return (
            <g key={i}>
              <line x1={margin.left} y1={y} x2={margin.left + plotW} y2={y} stroke="#262626" strokeDasharray="3 6" />
              <text x={margin.left - 8} y={y + 4} textAnchor="end" className="fill-neutral-500 text-[11px]">{yv.toFixed(3)}</text>
            </g>
          )
        })}

        {visibleSeries.map((s) => {
          const pts = s.runs.map((run) => ({
            run,
            x: scale(run.epoch, 0, 5, margin.left, margin.left + plotW),
            y: scale(valueFor(run, task, metric), yMin, yMax, margin.top + plotH, margin.top),
          }))
          return (
            <g key={s.key}>
              <path d={svgPath(pts)} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash} />
              {pts.map((p) => (
                <circle key={p.run.id} cx={p.x} cy={p.y} r={4.5} fill={s.color} stroke="#0a0a0a" strokeWidth={1.5}>
                  <title>{`${s.label}\nEpoch ${p.run.epoch}\n${TASK_LABELS[task]}: ${valueFor(p.run, task, metric).toFixed(3)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}

        <g>
          <circle cx={scale(0, 0, 5, margin.left, margin.left + plotW)} cy={scale(base, yMin, yMax, margin.top + plotH, margin.top)} r={6} fill="#ffffff" stroke="#0a0a0a" strokeWidth={2}>
            <title>{`Base model\n${TASK_LABELS[task]}: ${base.toFixed(3)}`}</title>
          </circle>
        </g>
      </svg>
    </div>
  )
}

export default function CheckpointDashboard({ baseModel, runs }: CheckpointDashboardProps) {
  const metrics = useMemo(() => metricOptions(baseModel), [baseModel])
  const [metric, setMetric] = useState(metrics[0]?.key ?? 'mrr_at_10')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(buildSeries(runs).map((s) => s.key)))
  const series = useMemo(() => buildSeries(runs), [runs])

  const chemrxivBest = useMemo(() => {
    const ordered = runs
      .slice()
      .sort((a, b) => valueFor(b, 'ChemRxivRetrieval', metric) - valueFor(a, 'ChemRxivRetrieval', metric))
    return ordered[0]
  }, [metric])

  const balancedBest = useMemo(() => {
    const ordered = runs
      .slice()
      .sort((a, b) => {
        const aScore = (valueFor(a, 'ChemHotpotQARetrieval', metric) + valueFor(a, 'ChemNQRetrieval', metric) + valueFor(a, 'ChemRxivRetrieval', metric)) / 3
        const bScore = (valueFor(b, 'ChemHotpotQARetrieval', metric) + valueFor(b, 'ChemNQRetrieval', metric) + valueFor(b, 'ChemRxivRetrieval', metric)) / 3
        return bScore - aScore
      })
    return ordered[0]
  }, [metric])

  const visibleSeries = series.filter((s) => selected.has(s.key))

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-neutral-500">ChEmbed checkpoint explorer</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Learning rate × epoch trajectories</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
              Interactive browser-based view of the first five epochs for vanilla, full, and plug. Every chart shows the base model as a single dot; checkpoint series are connected by lines so the trajectory is visible immediately.
            </p>
          </div>
        </header>

        <div className="mb-8 grid gap-4 lg:grid-cols-[280px,1fr]">
          <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-neutral-400">Metric</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {metrics.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setMetric(option.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${metric === option.key ? 'border-blue-400 bg-blue-500/20 text-blue-100' : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-neutral-500'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.14em] text-neutral-400">Series</div>
              <div className="mt-3 space-y-2">
                {series.map((s) => {
                  const active = selected.has(s.key)
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        const next = new Set(selected)
                        if (active) next.delete(s.key)
                        else next.add(s.key)
                        setSelected(next)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm ${active ? 'border-neutral-600 bg-neutral-950 text-white' : 'border-neutral-800 bg-neutral-950/40 text-neutral-500'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                      <span className="text-xs">{active ? 'on' : 'off'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Base · ChemRxiv" value={formatMetric(valueFor(baseModel, 'ChemRxivRetrieval', metric))} note="single reference dot" />
            <KpiCard label="Best ChemRxiv checkpoint" value={`${FAMILY_LABELS[chemrxivBest.family]} ${chemrxivBest.lr} · ep${chemrxivBest.epoch}`} note={formatMetric(valueFor(chemrxivBest, 'ChemRxivRetrieval', metric))} />
            <KpiCard label="Best balanced checkpoint" value={`${FAMILY_LABELS[balancedBest.family]} ${balancedBest.lr} · ep${balancedBest.epoch}`} note={`mean=${formatMetric((valueFor(balancedBest, 'ChemHotpotQARetrieval', metric) + valueFor(balancedBest, 'ChemNQRetrieval', metric) + valueFor(balancedBest, 'ChemRxivRetrieval', metric)) / 3)}`} />
            <KpiCard label="Visible series" value={String(visibleSeries.length)} note="toggle families/LRs in the sidebar" />
          </div>
        </div>

        <div className="space-y-6">
          <ScatterTradeoff baseModel={baseModel} series={series} metric={metric} visible={selected} />
          <div className="grid gap-6 xl:grid-cols-3">
            {TASKS.map((task) => (
              <TaskLineChart key={task} baseModel={baseModel} task={task} metric={metric} series={series} visible={selected} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

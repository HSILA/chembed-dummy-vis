export type TaskKey = 'ChemHotpotQARetrieval' | 'ChemNQRetrieval' | 'ChemRxivRetrieval'
export type Family = 'vanilla' | 'full' | 'plug'
export type LearningRate = '1e-5' | '1e-6'

export type MetricValue = number | string | string[] | null
export type MetricMap = Record<string, MetricValue>

export type Run = {
  id: string
  family: Family
  lr: LearningRate
  epoch: number
  tasks: Record<TaskKey, MetricMap>
}

export type BaseModel = {
  id: string
  label: string
  tasks: Record<TaskKey, MetricMap>
}

export type CheckpointDataset = {
  baseModel: BaseModel
  runs: Run[]
}

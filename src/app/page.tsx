import CheckpointDashboard from '@/components/CheckpointDashboard'
import { loadCheckpointData } from '@/lib/checkpointData'

export default async function HomePage() {
  const { baseModel, runs } = await loadCheckpointData()

  return <CheckpointDashboard baseModel={baseModel} runs={runs} />
}

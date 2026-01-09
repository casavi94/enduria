// lib/weekly/weeklyAutoStatus.ts
import { computeWeeklySignals, SessionLog } from "./signals"
import {
  computeRecommendation,
  WeeklyRecommendation,
  WeeklySignals,
  WeeklyStatus,
} from "./recommendation"

// Ajusta a tus datos reales
export type WeeklyAutoStatus = {
  status: WeeklyStatus
  reasons: Record<string, number> // ej: { injury: 1, time: 0, fatigue: 0 }
  signals: WeeklySignals
  recommendation: WeeklyRecommendation
}

// Ajusta a tu estructura real
export async function buildWeeklyAutoStatus(input: {
  // 1) lo que ya uses para calcular status (planned/done/skipped...)
  // 2) logs/checkins de la semana para señales
  logs: SessionLog[]
  // 3) status calculado por tu lógica actual
  baseStatus: WeeklyStatus
  // 4) contador de motivos (si ya lo tienes)
  reasons: Record<string, number>
}): Promise<WeeklyAutoStatus> {
  const signals = computeWeeklySignals(input.logs)
  const recommendation = computeRecommendation(input.baseStatus, signals)

  return {
    status: input.baseStatus,
    reasons: input.reasons,
    signals,
    recommendation,
  }
}

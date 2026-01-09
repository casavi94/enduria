// lib/weekly/signals.ts
import { WeeklySignals, round1 } from "./recommendation"

// Ajusta esta interfaz a tu estructura real (Firestore)
export type SessionLog = {
  rpe?: number | null       // 0-10
  fatigue?: number | null   // 0-10
  pain?: number | null      // 0-10
}

function avg(values: number[]) {
  if (!values.length) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return round1(sum / values.length)
}

export function computeWeeklySignals(logs: SessionLog[]): WeeklySignals {
  const rpes = logs.map(l => l.rpe).filter((v): v is number => typeof v === "number")
  const fats = logs.map(l => l.fatigue).filter((v): v is number => typeof v === "number")
  const pains = logs.map(l => l.pain).filter((v): v is number => typeof v === "number")

  const maxPain = pains.length ? Math.max(...pains) : null

  return {
    avgRpe: avg(rpes),
    avgFatigue: avg(fats),
    maxPain: typeof maxPain === "number" ? round1(maxPain) : null,
  }
}

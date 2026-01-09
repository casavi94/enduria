// lib/weekly/recommendation.ts

export type WeeklyStatus = "green" | "amber" | "red"

export type SkipReason = "injury" | "time" | "fatigue" | "other"

export type WeeklySignals = {
  avgRpe: number | null
  avgFatigue: number | null
  maxPain: number | null
}

export type WeeklyRecommendation = {
  title: string
  emoji: string
  message: string
  variant: "success" | "warning" | "danger"
}

export function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function computeRecommendation(
  status: WeeklyStatus,
  signals: WeeklySignals
): WeeklyRecommendation {
  const rpe = signals.avgRpe ?? 0
  const fat = signals.avgFatigue ?? 0
  const pain = signals.maxPain ?? 0

  // Reglas por señales (puedes ajustar umbrales)
  const highStress = rpe >= 7.5 || fat >= 7.5
  const highPain = pain >= 6

  if (status === "red" || highPain) {
    return {
      title: "Descanso / descarga",
      emoji: "🛌",
      message:
        "Prioriza recuperación. Si hay dolor alto, evita intensidad y valora bajar volumen o parar.",
      variant: "danger",
    }
  }

  if (status === "amber" || highStress) {
    return {
      title: "Baja carga",
      emoji: "⚠️",
      message:
        "Semana exigente. Mantén suave (Z1–Z2) y reduce intensidad para llegar fresco.",
      variant: "warning",
    }
  }

  return {
    title: "Sigue el plan",
    emoji: "✅",
    message: "Vas bien. Mantén el plan y progresa de forma normal.",
    variant: "success",
  }
}

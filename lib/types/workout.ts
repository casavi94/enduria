// ===============================
// Tipos de intensidad
// ===============================

export type IntensityType = "hr" | "power"

export type IntensityTarget = {
  zone?: string // "Z1", "Z2", "Z3", etc.
  min?: number  // límite inferior (futuro)
  max?: number  // límite superior (futuro)
}

export type Intensity = {
  type: IntensityType
  target?: IntensityTarget
}

// ===============================
// Estado del entreno
// ===============================

export type WorkoutStatus =
  | "planned"
  | "completed"
  | "modified"
  | "skipped"

// ===============================
// Check-in post-entreno
// ===============================

export type Feeling = "good" | "ok" | "heavy"

export type PainArea =
  | "knee"
  | "ankle"
  | "calf"
  | "hamstring"
  | "quad"
  | "hip"
  | "back"
  | "foot"
  | "other"

export type PainReport = {
  hasPain: boolean
  area?: PainArea
  intensity?: number // 1–10
  note?: string
}

export type CheckIn = {
  status: WorkoutStatus
  rpe: number // 1–10
  feeling: Feeling
  fatigue: number // 0–5
  sleep: number // 0–5
  pain: PainReport
  note?: string
  actual?: {
    durationMin?: number
    intensityHint?: "lower" | "same" | "higher"
  }
  completedAt: any // Firestore Timestamp
}

// ===============================
// Workout (entreno principal)
// ===============================

export type Workout = {
  id: string

  // Información básica
  title: string
  sport: "run" | "bike" | "strength" | "rest"
  date: any // Firestore Timestamp
  duration: number // minutos planificados

  // Intensidad (FC o Vatios)
  intensity: Intensity

  // Estado
  status: WorkoutStatus
  updatedAt: any // Firestore Timestamp
}

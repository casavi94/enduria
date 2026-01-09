export type TargetType = "hr" | "power" | "pace" | "free"

export type BlockTarget =
  | {
      type: "hr"
      min: number        // ppm
      max: number        // ppm
    }
  | {
      type: "power"
      value: number      // vatios
      tolerancePct?: number // ± %
    }
  | {
      type: "pace"
      minSecKm: number   // segundos/km
      maxSecKm: number
    }
  | {
      type: "free"
    }

export interface WorkoutBlock {
  label: string
  durationMin: number
  target: BlockTarget
  display?: string // solo UI, NO lógica
  note?: string
}

// ===============================
// Estado automático semanal
// ===============================

export type WeeklyAutoStatus = {
  weekStart: any // Firestore Timestamp
  status: "green" | "yellow" | "red"
  stats: {
    total: number
    done: number
    pending: number
    skipped: number
  }
  updatedAt: any // Firestore Timestamp
}

// ===============================
// Usuario ENDURIA
// ===============================

export type EnduriaUser = {
  id: string
  email?: string
  displayName?: string

  currentWeek?: number
  status?: "green" | "yellow" | "red"

  // ✅ NUEVO (aquí va lo que preguntas)
  weeklyAutoStatus?: WeeklyAutoStatus
}

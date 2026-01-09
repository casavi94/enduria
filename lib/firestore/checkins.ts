import { db } from "@/lib/firebase"
import {
  doc,
  collection,
  setDoc,
  serverTimestamp,
} from "firebase/firestore"
import type { CheckIn, WorkoutStatus } from "@/lib/types/workout"
import { deepClean } from "@/lib/firestore/clean"
import { recomputeWeeklyAutoStatus } from "@/lib/firestore/weeklyStatus"

// ===============================
// Helpers
// ===============================

function removeUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    // @ts-ignore
    return obj.map(removeUndefinedDeep) as T
  }
  if (typeof obj === "object") {
    const out: any = {}
    for (const [k, v] of Object.entries(obj as any)) {
      if (v === undefined) continue
      out[k] = removeUndefinedDeep(v)
    }
    return out
  }
  return obj
}

// ===============================
// Save check-in
// ===============================

export async function saveCheckIn(params: {
  uid: string
  workoutId: string
  checkin: Omit<CheckIn, "completedAt">
}) {
  const { uid, workoutId, checkin } = params

  if (!uid) throw new Error("saveCheckIn: uid is missing")
  if (!workoutId) throw new Error("saveCheckIn: workoutId is missing")

  // 1) Guardar check-in (autoId)
  const checkinRef = doc(
    collection(db, "users", uid, "workouts", workoutId, "checkins")
  )

  const checkinPayload = deepClean({
    ...checkin,
    completedAt: serverTimestamp(),
  })

  await setDoc(checkinRef, checkinPayload)

  // 2) Construir lastCheckinSummary (cache para dashboard)
  const summaryRaw = {
    rpe: checkin.rpe,
    fatigue: checkin.fatigue,
    pain: {
      hasPain: checkin.pain?.hasPain ?? false,
      intensity: checkin.pain?.intensity,
      area: checkin.pain?.area,
    },
  }

  const lastCheckinSummary = removeUndefinedDeep(summaryRaw)

  // 3) Actualizar workout (merge)
  const workoutRef = doc(db, "users", uid, "workouts", workoutId)

  await setDoc(
    workoutRef,
    deepClean({
      status: checkin.status as WorkoutStatus,
      updatedAt: serverTimestamp(),

      // cacheado para dashboard instantáneo
      lastCheckinSummary,
      lastCheckinAt: serverTimestamp(),
    }),
    { merge: true }
  )

  // 4) Compatibilidad legacy (sessions antiguas)
  const legacySessionRef = doc(db, "users", uid, "sessions", workoutId)
  await setDoc(
    legacySessionRef,
    {
      completed:
        checkin.status === "completed" || checkin.status === "modified",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  // 5) ✅ Recalcular estado semanal del usuario
  await recomputeWeeklyAutoStatus({ uid })

  return checkinRef.id
}

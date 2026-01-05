import { db } from "@/lib/firebase"
import {
  doc,
  collection,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore"
import type { CheckIn, WorkoutStatus } from "@/lib/types/workout"
import { deepClean } from "@/lib/firestore/clean"

/**
 * Guarda un check-in post-entreno y actualiza:
 * - workout.status
 * - workout.lastCheckinSummary + workout.lastCheckinAt (para dashboard instantáneo)
 * - sessions.completed (compatibilidad legacy)
 */
export async function saveCheckIn(params: {
  uid: string
  workoutId: string
  checkin: Omit<CheckIn, "completedAt">
}) {
  const { uid, workoutId, checkin } = params

  if (!uid) throw new Error("saveCheckIn: uid is missing")
  if (!workoutId) throw new Error("saveCheckIn: workoutId is missing")

  // 1) Guardar check-in (autoId)
  const ref = doc(
    collection(db, "users", uid, "workouts", workoutId, "checkins")
  )

  const payload = deepClean({
    ...checkin,
    completedAt: serverTimestamp(),
  })

  await setDoc(ref, payload)

  // 2) Actualizar workout (merge) + lastCheckinSummary
  const workoutRef = doc(db, "users", uid, "workouts", workoutId)

  const lastCheckinSummary = deepClean({
    rpe: checkin.rpe,
    fatigue: checkin.fatigue,
    pain: {
      hasPain: checkin.pain?.hasPain ?? false,
      intensity: checkin.pain?.intensity,
      area: checkin.pain?.area,
    },
  })

  await setDoc(
    workoutRef,
    deepClean({
      status: checkin.status as WorkoutStatus,
      updatedAt: serverTimestamp(),

      // ✅ nuevo: dashboard instantáneo
      lastCheckinSummary,
      lastCheckinAt: serverTimestamp(),
    }),
    { merge: true }
  )

  // 3) Compatibilidad con sessions (legacy)
  const legacySessionRef = doc(db, "users", uid, "sessions", workoutId)
  await setDoc(
    legacySessionRef,
    {
      completed: checkin.status === "completed" || checkin.status === "modified",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  return ref.id
}

/**
 * Obtiene el último check-in de un workout (por si lo necesitas en detalle)
 */
export async function getLatestCheckIn(params: {
  uid: string
  workoutId: string
}) {
  const { uid, workoutId } = params
  if (!uid || !workoutId) return null

  const q = query(
    collection(db, "users", uid, "workouts", workoutId, "checkins"),
    orderBy("completedAt", "desc"),
    limit(1)
  )

  const snap = await getDocs(q)
  if (snap.empty) return null

  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

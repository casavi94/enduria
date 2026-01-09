import { db } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { recomputeWeeklyAutoStatus } from "@/lib/firestore/weeklyStatus"

export type SkippedReason = "injury" | "sick" | "fatigue" | "time" | "other"

export async function markWorkoutSkipped(params: {
  uid: string
  workoutId: string
  reason: SkippedReason
  note?: string
}) {
  const { uid, workoutId, reason, note } = params

  if (!uid) throw new Error("markWorkoutSkipped: uid is missing")
  if (!workoutId) throw new Error("markWorkoutSkipped: workoutId is missing")

  const workoutRef = doc(db, "users", uid, "workouts", workoutId)

  // 1) Leer el workout para tener su fecha (así recalculamos la semana correcta)
  const snap = await getDoc(workoutRef)
  const workoutData = snap.exists() ? snap.data() : null
  const workoutDate: Date | undefined =
    workoutData?.date?.toDate ? workoutData.date.toDate() : undefined

  // 2) Marcar como skipped
  await setDoc(
    workoutRef,
    {
      status: "skipped",
      skippedReason: reason,
      skippedNote: note?.trim() ? note.trim() : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  // 3) ✅ Recalcular weeklyAutoStatus + signals + recommendation
  await recomputeWeeklyAutoStatus({
    uid,
    refDate: workoutDate ?? new Date(),
  })
}

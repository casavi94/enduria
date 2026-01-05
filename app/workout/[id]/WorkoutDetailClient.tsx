"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import CheckInForm from "./CheckInForm"

function intensityLabel(intensity: any) {
  const type = intensity?.type
  const zone = intensity?.target?.zone
  const icon = type === "power" ? "⚡" : "❤️"
  return zone ? `${icon} ${zone}` : icon
}

export default function WorkoutDetailClient({ workoutId }: { workoutId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)

      if (!u) {
        router.replace("/login")
        return
      }

      try {
        setLoading(true)
        setError(null)

        const ref = doc(db, "users", u.uid, "workouts", workoutId)
        const snap = await getDoc(ref)

        if (!snap.exists()) {
          setWorkout(null)
          setError("No se encontró el entreno.")
          return
        }

        setWorkout({ id: snap.id, ...snap.data() })
      } catch (e: any) {
        setError(e?.message ?? "Error cargando el entreno")
        setWorkout(null)
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [router, workoutId])

  if (loading) return <div className="text-sm opacity-70">Cargando...</div>
  if (!user) return null

  if (!workout) {
    return (
      <div className="space-y-2">
        <div className="font-semibold">No se encontró el entreno</div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    )
  }

  const dateStr =
    workout?.date?.toDate
      ? workout.date.toDate().toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" })
      : ""

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="border rounded p-4 space-y-1">
        <div className="text-xl font-bold">{workout.title ?? "Entreno"}</div>

        <div className="text-sm opacity-70">
          {workout.sport ?? ""}{workout.duration ? ` · ${workout.duration} min` : ""}{dateStr ? ` · ${dateStr}` : ""}
        </div>

        <div className="text-sm">
          <span className="font-medium">Intensidad:</span>{" "}
          <span>{intensityLabel(workout.intensity)}</span>
        </div>
      </div>

      {/* Check-in */}
      <CheckInForm uid={user.uid} workoutId={workoutId} />
    </div>
  )
}

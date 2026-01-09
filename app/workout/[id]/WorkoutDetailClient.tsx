"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import CheckInForm from "./CheckInForm"
import { markWorkoutSkipped, type SkippedReason } from "@/lib/firestore/workouts"
import WorkoutBlocks from "../_components/WorkoutBlocks"


function intensityLabel(intensity: any) {
  const type = intensity?.type
  const zone = intensity?.target?.zone
  const icon = type === "power" ? "⚡" : "❤️"
  return zone ? `${icon} ${zone}` : icon
}




function reasonLabel(r: SkippedReason) {
  if (r === "injury") return "Lesión / dolor"
  if (r === "sick") return "Enfermedad"
  if (r === "fatigue") return "Fatiga / sobrecarga"
  if (r === "time") return "Falta de tiempo"
  return "Otro"
}

export default function WorkoutDetailClient({ workoutId }: { workoutId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [showSkip, setShowSkip] = useState(false)
  const [skipReason, setSkipReason] = useState<SkippedReason>("time")
  const [skipNote, setSkipNote] = useState("")

  const router = useRouter()

  async function loadWorkout(u: User, wid: string) {
    const ref = doc(db, "users", u.uid, "workouts", wid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      setWorkout(null)
      setError("No se encontró el entreno.")
      return
    }
    setWorkout({ id: snap.id, ...snap.data() })
  }

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
        await loadWorkout(u, workoutId)
      } catch (e: any) {
        setError(e?.message ?? "Error cargando el entreno")
        setWorkout(null)
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [router, workoutId])

  const canSkip = workout?.status === "planned"

  const onConfirmSkip = async () => {
    if (!user || !workout) return
    if (!canSkip) return

    const ok = confirm(
      `¿Seguro que quieres marcar este entreno como SALTADO?\nMotivo: ${reasonLabel(skipReason)}`
    )
    if (!ok) return

    try {
      setBusy(true)
      await markWorkoutSkipped({
        uid: user.uid,
        workoutId,
        reason: skipReason,
        note: skipNote,
      })

      await loadWorkout(user, workoutId)
      router.push("/dashboard")
    } catch (e: any) {
      alert(e?.message ?? "Error al saltar el entreno")
    } finally {
      setBusy(false)
    }
  }

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
      ? workout.date.toDate().toLocaleDateString("es-ES", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })
      : ""

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="border rounded p-4 space-y-1">
        <div className="text-xl font-bold">{workout.title ?? "Entreno"}</div>

        <div className="text-sm opacity-70">
          {workout.sport ?? ""}
          {workout.duration ? ` · ${workout.duration} min` : ""}
          {dateStr ? ` · ${dateStr}` : ""}
        </div>

        <div className="text-sm">
          <span className="font-medium">Intensidad:</span>{" "}
          <span>{intensityLabel(workout.intensity)}</span>
        </div>
        
        {workout.blocks && (
          <WorkoutBlocks blocks={workout.blocks} />
        )}


        <div className="text-sm">
          <span className="font-medium">Estado:</span>{" "}
          <span className="opacity-80">{workout.status ?? "planned"}</span>
        </div>

        {workout.status === "skipped" && (
          <div className="text-sm mt-2 border rounded p-3">
            <div className="font-medium">❌ Saltado</div>
            {workout.skippedReason && (
              <div className="opacity-80">
                Motivo: <strong>{reasonLabel(workout.skippedReason)}</strong>
              </div>
            )}
            {workout.skippedNote && (
              <div className="opacity-80">
                Nota: <span>{workout.skippedNote}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acción: Saltar */}
      {canSkip && !showSkip && (
        <button
          onClick={() => setShowSkip(true)}
          className="w-full border border-red-400 text-red-700 p-3 rounded"
        >
          ❌ Saltar entreno (con motivo)
        </button>
      )}

      {canSkip && showSkip && (
        <div className="border rounded p-4 space-y-3">
          <div className="font-semibold">Motivo para saltar</div>

          <select
            className="border rounded p-3 w-full"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value as SkippedReason)}
          >
            <option value="injury">Lesión / dolor</option>
            <option value="sick">Enfermedad</option>
            <option value="fatigue">Fatiga / sobrecarga</option>
            <option value="time">Falta de tiempo</option>
            <option value="other">Otro</option>
          </select>

          <textarea
            className="border rounded p-3 w-full min-h-[90px]"
            placeholder="Nota opcional (ej: dolor en rodilla, viaje, etc.)"
            value={skipNote}
            onChange={(e) => setSkipNote(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={onConfirmSkip}
              className="flex-1 bg-black text-white p-3 rounded"
            >
              {busy ? "Guardando..." : "Confirmar salto"}
            </button>

            <button
              disabled={busy}
              onClick={() => setShowSkip(false)}
              className="flex-1 border p-3 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Check-in */}
      {workout.status !== "skipped" && (
        <CheckInForm uid={user.uid} workoutId={workoutId} />
      )}

      {workout.status === "skipped" && (
        <div className="border rounded p-4 text-sm">
          Este entreno está marcado como <strong>saltado</strong>.
        </div>
      )}
    </div>
  )
}

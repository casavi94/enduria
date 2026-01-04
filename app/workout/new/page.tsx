"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"

export default function NewWorkoutPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [sport, setSport] = useState<"run" | "bike" | "strength">("run")
  const [date, setDate] = useState("")
  const [duration, setDuration] = useState<number>(45)

  const [intensityType, setIntensityType] = useState<"hr" | "power">("hr")
  const [zone, setZone] = useState("Z2")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 🔐 Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login")
        return
      }
      setUid(user.uid)
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uid) return

    setSaving(true)
    setError(null)

    try {
      const workoutsRef = collection(db, "users", uid, "workouts")
      const ref = doc(workoutsRef)

      await setDoc(ref, {
        title: title || "Entreno",
        sport,
        duration,
        date: Timestamp.fromDate(new Date(date)),
        intensity: {
          type: intensityType,
          target: { zone },
        },
        status: "planned",
        updatedAt: serverTimestamp(),
      })

      router.push("/dashboard")
    } catch (e: any) {
      setError(e?.message ?? "Error creando entreno")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6">Cargando...</p>

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Nuevo entreno</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Título */}
        <div>
          <label className="block text-sm font-medium">Título</label>
          <input
            className="border rounded p-2 w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rodaje Z2"
          />
        </div>

        {/* Deporte */}
        <div>
          <label className="block text-sm font-medium">Deporte</label>
          <select
            className="border rounded p-2 w-full"
            value={sport}
            onChange={(e) => setSport(e.target.value as any)}
          >
            <option value="run">🏃 Running</option>
            <option value="bike">🚴 Ciclismo</option>
            <option value="strength">🏋️ Fuerza</option>
          </select>
        </div>

        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium">Fecha</label>
          <input
            type="date"
            className="border rounded p-2 w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {/* Duración */}
        <div>
          <label className="block text-sm font-medium">Duración (min)</label>
          <input
            type="number"
            className="border rounded p-2 w-full"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>

        {/* Intensidad */}
        <div>
          <label className="block text-sm font-medium">
            Control de intensidad
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIntensityType("hr")}
              className={`flex-1 border rounded p-2 ${
                intensityType === "hr" ? "bg-black text-white" : ""
              }`}
            >
              ❤️ Frecuencia cardiaca
            </button>

            <button
              type="button"
              onClick={() => setIntensityType("power")}
              className={`flex-1 border rounded p-2 ${
                intensityType === "power" ? "bg-black text-white" : ""
              }`}
            >
              ⚡ Vatios
            </button>
          </div>
        </div>

        {/* Zona */}
        <div>
          <label className="block text-sm font-medium">Zona objetivo</label>
          <select
            className="border rounded p-2 w-full"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          >
            <option>Z1</option>
            <option>Z2</option>
            <option>Z3</option>
            <option>Z4</option>
            <option>Z5</option>
          </select>
        </div>

        {/* Error */}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Guardar */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-black text-white p-3 rounded disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Crear entreno"}
        </button>
      </form>
    </div>
  )
}

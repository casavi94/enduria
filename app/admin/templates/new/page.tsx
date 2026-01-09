"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"

import {
  createTemplate,
  getMyRole,
} from "@/lib/firestore/admin"

import BlocksEditor from "../_components/BlocksEditor"
import { describeWorkoutFromBlocks } from "@/lib/training/describeWorkout"

import { WorkoutBlock } from "@/lib/types/workoutBlocks"

// =======================
// Page
// =======================

export default function AdminNewTemplatePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---------- Template fields ----------
  const [title, setTitle] = useState("")
  const [sport, setSport] = useState<"run" | "bike" | "strength">("run")
  const [method, setMethod] = useState<"hr" | "power">("hr")

  // ---------- Blocks (B1.1 normalized) ----------
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([
    {
      label: "Calentamiento",
      durationMin: 10,
      target: { type: "hr", min: 135, max: 150 },
      display: "135–150 ppm (Z1–Z2)",
    },
    {
      label: "Bloque principal",
      durationMin: 40,
      target: { type: "power", value: 188, tolerancePct: 5 },
      display: "188 W ±5%",
    },
    {
      label: "Vuelta a la calma",
      durationMin: 10,
      target: { type: "hr", min: 130, max: 140 },
      display: "130–140 ppm",
    },
  ])

  const [saving, setSaving] = useState(false)

  // =======================
  // Auth / role check
  // =======================

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login")
        return
      }

      try {
        const role = await getMyRole(user.uid)
        if (role !== "admin" && role !== "coach") {
          router.replace("/dashboard")
          return
        }
      } catch (e: any) {
        setError(e?.message ?? "Error comprobando permisos")
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [router])

  // =======================
  // Actions
  // =======================

  async function onCreateTemplate() {
    if (!title) {
      setError("El título es obligatorio")
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createTemplate({
        template: {
          title,
          sport,
          method,
          blocks, // 👈 bloques normalizados FC / vatios
          description: describeWorkoutFromBlocks(blocks),
        },
      })

      alert("✅ Plantilla creada correctamente")
      router.push("/admin/templates")
    } catch (e: any) {
      setError(e?.message ?? "Error creando plantilla")
    } finally {
      setSaving(false)
    }
  }

  // =======================
  // Render
  // =======================

  if (loading) return <div className="opacity-70">Cargando…</div>

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Nueva plantilla de entreno</h1>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* ---------- Datos básicos ---------- */}
      <div className="border rounded p-4 space-y-3">
        <div className="font-semibold">Datos básicos</div>

        <input
          className="border rounded p-3 w-full"
          placeholder="Título del entreno (ej: Rodaje aeróbico)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            className="border rounded p-3"
            value={sport}
            onChange={(e) => setSport(e.target.value as any)}
          >
            <option value="run">🏃 Running</option>
            <option value="bike">🚴 Ciclismo</option>
            <option value="strength">🏋️ Fuerza</option>
          </select>

          <select
            className="border rounded p-3"
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
          >
            <option value="hr">❤️ Frecuencia cardíaca</option>
            <option value="power">⚡ Potencia</option>
          </select>
        </div>
      </div>

      {/* ---------- Blocks Editor ---------- */}
      <div className="border rounded p-4">
        <BlocksEditor blocks={blocks} onChange={setBlocks} />
      </div>

      {/* ---------- Auto description ---------- */}
      <div className="border rounded p-4 space-y-2">
        <div className="font-semibold">Descripción generada</div>
        <textarea
          className="border rounded p-3 w-full bg-gray-50 text-sm"
          value={describeWorkoutFromBlocks(blocks)}
          readOnly
          rows={6}
        />
      </div>

      {/* ---------- Actions ---------- */}
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={onCreateTemplate}
          className="flex-1 rounded bg-black text-white py-3 disabled:opacity-60"
        >
          {saving ? "Guardando…" : "✅ Crear plantilla"}
        </button>

        <button
          className="border rounded px-4 py-3"
          onClick={() => router.push("/admin/templates")}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

import {
  assignTemplateToAthlete,
  getMyRole,
  listTemplates,
  type WorkoutTemplate,
} from "@/lib/firestore/admin"

import { generateWeekForAthlete } from "@/lib/firestore/autoplan"

// =======================
// Helpers
// =======================

function toISODateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// =======================
// Page
// =======================

export default function AdminAthletePage() {
  const router = useRouter()
  const params = useParams()
  const athleteUid = String(params.uid)

  const [loading, setLoading] = useState(true)
  const [meUid, setMeUid] = useState<string | null>(null)

  const [athlete, setAthlete] = useState<any>(null)
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [error, setError] = useState<string | null>(null)

  // ---------- Asignación manual ----------
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const selectedTemplate: WorkoutTemplate | null = useMemo(() => {
    const t = templates.find((x) => x.id === selectedTemplateId)
    return t ?? null
  }, [templates, selectedTemplateId])

  const [dateStr, setDateStr] = useState(() => toISODateInput(new Date()))
  const [busyAssign, setBusyAssign] = useState(false)

  // ---------- A3 Autoplan ----------
  const [autoWeekDate, setAutoWeekDate] = useState(() =>
    toISODateInput(new Date())
  )
  const [busyAuto, setBusyAuto] = useState(false)

  // =======================
  // Load auth + data
  // =======================

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login")
        return
      }

      setLoading(true)
      setError(null)

      try {
        const role = await getMyRole(user.uid)
        if (role !== "admin" && role !== "coach") {
          router.replace("/dashboard")
          return
        }

        setMeUid(user.uid)

        const athleteRef = doc(db, "users", athleteUid)
        const athleteSnap = await getDoc(athleteRef)
        setAthlete(
          athleteSnap.exists()
            ? { id: athleteSnap.id, ...athleteSnap.data() }
            : null
        )

        const ts = await listTemplates()
        setTemplates(ts)
        if (ts.length && !selectedTemplateId) {
          setSelectedTemplateId(ts[0].id)
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando atleta o plantillas")
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [router, athleteUid])

  // =======================
  // Actions
  // =======================

  async function onAssignTemplate() {
    if (!athleteUid || !selectedTemplate) return

    const d = new Date(dateStr + "T08:00:00")
    setBusyAssign(true)
    setError(null)

    try {
      await assignTemplateToAthlete({
        athleteUid,
        date: d,
        templateId: selectedTemplate.id,
        template: selectedTemplate,
      })
      alert("✅ Entreno asignado correctamente")
    } catch (e: any) {
      setError(e?.message ?? "Error asignando entreno")
    } finally {
      setBusyAssign(false)
    }
  }

  async function onAutoGenerateWeek() {
    if (!athleteUid) return

    try {
      setBusyAuto(true)
      const refDate = new Date(autoWeekDate + "T08:00:00")
      const res = await generateWeekForAthlete({
        athleteUid,
        refDate,
        overwrite: false,
      })
      alert(`✅ Semana generada · Entrenos creados: ${res.created}`)
    } catch (e: any) {
      alert(e?.message ?? "Error generando semana automática")
    } finally {
      setBusyAuto(false)
    }
  }

  // =======================
  // Render
  // =======================

  if (loading) return <div className="opacity-70">Cargando atleta…</div>

  if (!athlete) {
    return (
      <div className="border rounded p-4">
        <div className="font-semibold">Atleta no encontrado</div>
        <div className="text-sm opacity-70">UID: {athleteUid}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ================= Cabecera atleta ================= */}
      <div className="border rounded p-4">
        <div className="text-xl font-bold">{athlete.name ?? "Atleta"}</div>
        <div className="text-sm opacity-70">
          {athlete.email ?? athleteUid}
        </div>
        <div className="text-xs opacity-60 mt-1">
          Estado semanal:{" "}
          <strong>{athlete.weeklyAutoStatus?.status ?? "—"}</strong> · Semana{" "}
          {athlete.currentWeek ?? "—"}
        </div>
      </div>

      {/* ================= A2 Asignación manual ================= */}
      <div className="border rounded p-4 space-y-3">
        <div className="font-semibold">Asignar entreno desde plantilla</div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-sm opacity-70">Plantilla</div>
            <select
              className="border rounded p-3 w-full"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.sport} · {t.method}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm opacity-70">Fecha</div>
            <input
              className="border rounded p-3 w-full"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>
        </div>

        {selectedTemplate && (
          <div className="rounded border bg-gray-50 p-3 text-sm">
            <div className="font-semibold">{selectedTemplate.title}</div>
            <div className="opacity-70">
              {selectedTemplate.sport} · {selectedTemplate.method}
              {selectedTemplate.durationMin
                ? ` · ${selectedTemplate.durationMin} min`
                : ""}
            </div>
            {selectedTemplate.description && (
              <div className="mt-2 opacity-80">
                {selectedTemplate.description}
              </div>
            )}
          </div>
        )}

        <button
          disabled={busyAssign || !selectedTemplate}
          onClick={onAssignTemplate}
          className="w-full rounded bg-black text-white py-3 disabled:opacity-60"
        >
          {busyAssign ? "Asignando…" : "✅ Asignar entreno"}
        </button>
      </div>

      {/* ================= A3 Autoplan semanal ================= */}
      <div className="border rounded p-4 space-y-3">
        <div className="font-semibold">
          ⚡ Generar semana automática (A3)
        </div>

        <div className="text-sm opacity-70">
          Enduria usará tus plantillas para crear una semana tipo
          (running, bici, fuerza).  
          No se sobrescriben entrenos ya existentes.
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-sm opacity-70">Fecha de referencia</div>
            <input
              className="border rounded p-3 w-full"
              type="date"
              value={autoWeekDate}
              onChange={(e) => setAutoWeekDate(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              disabled={busyAuto}
              onClick={onAutoGenerateWeek}
              className="w-full rounded bg-black text-white py-3 disabled:opacity-60"
            >
              {busyAuto ? "Generando…" : "⚡ Generar semana"}
            </button>
          </div>
        </div>

        <div className="text-xs opacity-60">
          Consejo: usa tags en plantillas (
          <code>easy</code>, <code>quality</code>, <code>long</code>,
          <code>strength</code>) para mejores decisiones automáticas.
        </div>
      </div>

      {/* ================= Acciones rápidas ================= */}
      <div className="border rounded p-4 text-sm">
        <div className="font-semibold mb-1">Acciones rápidas</div>
        <div className="flex flex-wrap gap-2">
          <button
            className="border rounded px-3 py-2"
            onClick={() => router.push(`/dashboard`)}
          >
            Ver mi dashboard
          </button>
          <button
            className="border rounded px-3 py-2"
            onClick={() => router.push(`/dashboard?athlete=${athleteUid}`)}
          >
            (futuro) Ver dashboard atleta
          </button>
        </div>
      </div>
    </div>
  )
}

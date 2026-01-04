"use client"

import { useState } from "react"
import type { Feeling, WorkoutStatus, PainArea } from "@/lib/types/workout"
import { saveCheckIn } from "@/lib/firestore/checkins"

const painAreas: { value: PainArea; label: string }[] = [
  { value: "knee", label: "Rodilla" },
  { value: "ankle", label: "Tobillo" },
  { value: "calf", label: "Gemelo" },
  { value: "hamstring", label: "Isquios" },
  { value: "quad", label: "Cuádriceps" },
  { value: "hip", label: "Cadera" },
  { value: "back", label: "Espalda" },
  { value: "foot", label: "Pie" },
  { value: "other", label: "Otra" },
]

export default function CheckInForm(props: { uid: string; workoutId: string }) {
  const { uid, workoutId } = props
  console.log("[CheckInForm props]", { uid, workoutId })


  const [status, setStatus] = useState<WorkoutStatus>("completed")
  const [rpe, setRpe] = useState(5)
  const [feeling, setFeeling] = useState<Feeling>("ok")
  const [fatigue, setFatigue] = useState(2)
  const [sleep, setSleep] = useState(3)

  const [hasPain, setHasPain] = useState(false)
  const [painArea, setPainArea] = useState<PainArea>("knee")
  const [painIntensity, setPainIntensity] = useState(3)
  const [painNote, setPainNote] = useState("")

  const [note, setNote] = useState("")
  const [durationMin, setDurationMin] = useState<number | "">("")
  const [intensityHint, setIntensityHint] = useState<"lower" | "same" | "higher">("same")

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSkipped = status === "skipped"
  const isModified = status === "modified"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      await saveCheckIn({
        uid,
        workoutId,
        checkin: {
          status,
          rpe: isSkipped ? 1 : rpe,
          feeling: isSkipped ? "ok" : feeling,
          fatigue: isSkipped ? 0 : fatigue,
          sleep: isSkipped ? 0 : sleep,
          pain: isSkipped
            ? { hasPain: false }
            : hasPain
            ? { hasPain: true, area: painArea, intensity: painIntensity, note: painNote || undefined }
            : { hasPain: false },
          note: note || undefined,
          actual: isModified
            ? {
                durationMin: durationMin === "" ? undefined : Number(durationMin),
                intensityHint,
              }
            : undefined,
        },
      })
      setSaved(true)
    } catch (err: any) {
      setError(err?.message ?? "Error guardando el check-in")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Check-in post-entreno</h3>

      {/* Estado */}
      <div className="space-y-2">
        <div className="font-medium">¿Qué ha pasado con el entreno?</div>
        <div className="flex flex-wrap gap-2">
          {[
            ["completed", "✅ Hecho tal cual"],
            ["modified", "🟡 Lo modifiqué"],
            ["skipped", "❌ No lo hice"],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setStatus(v as WorkoutStatus)}
              className={`px-3 py-2 rounded border ${
                status === v ? "bg-black text-white" : "bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Si NO realizado -> formulario minimal */}
      {isSkipped ? (
        <div className="space-y-2">
          <div className="font-medium">Motivo (opcional)</div>
          <input
            className="border rounded p-2 w-full"
            placeholder="Ej: trabajo, cansancio, clima..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      ) : (
        <>
          {/* RPE */}
          <div className="space-y-2">
            <div className="font-medium">Esfuerzo (RPE): {rpe}</div>
            <input
              type="range"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Feeling */}
          <div className="space-y-2">
            <div className="font-medium">Sensación</div>
            <div className="flex gap-2">
              {[
                ["good", "😄 Muy bien"],
                ["ok", "🙂 Normal"],
                ["heavy", "😵 Cargado"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFeeling(v as Feeling)}
                  className={`px-3 py-2 rounded border ${
                    feeling === v ? "bg-black text-white" : "bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fatiga / Sueño */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-medium">Fatiga: {fatigue}/5</div>
              <input
                type="range"
                min={0}
                max={5}
                value={fatigue}
                onChange={(e) => setFatigue(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <div className="font-medium">Sueño: {sleep}/5</div>
              <input
                type="range"
                min={0}
                max={5}
                value={sleep}
                onChange={(e) => setSleep(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Modificado */}
          {isModified && (
            <div className="space-y-2 border rounded p-3">
              <div className="font-medium">Datos reales (si lo recuerdas)</div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border rounded p-2"
                  placeholder="Duración real (min)"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <select
                  className="border rounded p-2"
                  value={intensityHint}
                  onChange={(e) => setIntensityHint(e.target.value as any)}
                >
                  <option value="lower">Menos intensidad</option>
                  <option value="same">Igual</option>
                  <option value="higher">Más intensidad</option>
                </select>
              </div>
            </div>
          )}

          {/* Dolor */}
          <div className="space-y-2 border rounded p-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hasPain} onChange={(e) => setHasPain(e.target.checked)} />
              <span className="font-medium">He tenido molestias</span>
            </label>

            {hasPain && (
              <div className="space-y-2">
                <select
                  className="border rounded p-2 w-full"
                  value={painArea}
                  onChange={(e) => setPainArea(e.target.value as PainArea)}
                >
                  {painAreas.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>

                <div className="font-medium">Intensidad: {painIntensity}/10</div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={painIntensity}
                  onChange={(e) => setPainIntensity(Number(e.target.value))}
                  className="w-full"
                />

                <input
                  className="border rounded p-2 w-full"
                  placeholder="Nota (opcional)"
                  value={painNote}
                  onChange={(e) => setPainNote(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Nota */}
          <div className="space-y-2">
            <div className="font-medium">Nota (opcional)</div>
            <input
              className="border rounded p-2 w-full"
              placeholder="Ej: viento, piernas pesadas..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </>
      )}

      <button
        disabled={saving}
        className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
        type="submit"
      >
        {saving ? "Guardando..." : "Guardar check-in"}
      </button>

      {saved && <div className="text-sm">✅ Guardado</div>}
      {error && <div className="text-sm text-red-600">❌ {error}</div>}
    </form>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  Timestamp,
} from "firebase/firestore"

type SportFilter = "all" | "run" | "bike" | "strength"

function startOfWeekMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay() // 0 domingo, 1 lunes...
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, days: number) {
  const date = new Date(d)
  date.setDate(date.getDate() + days)
  return date
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function fmtRange(a: Date, b: Date) {
  const f = (x: Date) =>
    x.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
  return `${f(a)} – ${f(b)}`
}

function fmtDayLabel(d: Date) {
  return d
    .toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" })
    .toUpperCase()
}

function intensityLabel(intensity: any) {
  const type = intensity?.type
  const zone = intensity?.target?.zone
  const icon = type === "power" ? "⚡" : "❤️"
  return zone ? `${icon} ${zone}` : icon
}

function statusBadge(status?: string) {
  if (status === "completed") return "✅"
  if (status === "modified") return "🟡"
  if (status === "skipped") return "❌"
  return "⬜"
}

function statusPillText(status?: string) {
  if (status === "completed") return "Completado"
  if (status === "modified") return "Modificado"
  if (status === "skipped") return "Saltado"
  return "Pendiente"
}

function cardClassForStatus(status?: string) {
  if (status === "completed") return "border border-green-300"
  if (status === "modified") return "border border-yellow-300"
  if (status === "skipped") return "border border-red-300"
  return "border border-gray-200"
}

function severity(status: "green" | "yellow" | "red") {
  return status === "red" ? 3 : status === "yellow" ? 2 : 1
}
function worst(a: "green" | "yellow" | "red", b: "green" | "yellow" | "red") {
  return severity(a) >= severity(b) ? a : b
}

/**
 * Estado automático basado en:
 * - progreso semanal (done/total)
 * - skipped
 * - lastCheckinSummary (rpe/fatigue/pain) YA cacheado en el workout
 */
function calcAutoStatus(params: {
  workouts: any[]
}) {
  const { workouts } = params

  const total = workouts.length
  const done = workouts.filter(
    (w) => w.status === "completed" || w.status === "modified"
  ).length
  const skipped = workouts.filter((w) => w.status === "skipped").length
  const pending = workouts.filter((w) => w.status === "planned").length

  let result: "green" | "yellow" | "red" = "green"

  // Progreso semanal
  if (total > 0) {
    const pct = (done / total) * 100
    if (pct < 50) result = "red"
    else if (pct < 80) result = "yellow"
  }

  // Skips
  if (skipped >= 2) result = worst(result, "red")
  else if (skipped === 1) result = worst(result, "yellow")

  // Check-ins (cacheados)
  const summaries = workouts
    .map((w) => w.lastCheckinSummary)
    .filter(Boolean)

  if (summaries.length > 0) {
    const rpes = summaries
      .map((s: any) => s?.rpe)
      .filter((x: any) => typeof x === "number") as number[]
    const fatigues = summaries
      .map((s: any) => s?.fatigue)
      .filter((x: any) => typeof x === "number") as number[]
    const pains = summaries
      .map((s: any) => s?.pain)
      .filter(Boolean)

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    const avgRpe = avg(rpes)
    const avgFatigue = avg(fatigues)

    if (avgRpe !== null) {
      if (avgRpe >= 8) result = worst(result, "red")
      else if (avgRpe >= 6.5) result = worst(result, "yellow")
    }

    if (avgFatigue !== null) {
      if (avgFatigue >= 4) result = worst(result, "red")
      else if (avgFatigue >= 3) result = worst(result, "yellow")
    }

    const maxPain = pains.reduce((m: number, p: any) => {
      const v = p?.hasPain ? Number(p?.intensity ?? 0) : 0
      return Math.max(m, isNaN(v) ? 0 : v)
    }, 0)

    if (maxPain >= 7) result = worst(result, "red")
    else if (maxPain >= 5) result = worst(result, "yellow")
  }

  return {
    autoStatus: result,
    stats: { total, done, pending, skipped },
  }
}

export default function DashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)

  const [userData, setUserData] = useState<any>(null)

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeekMonday(new Date())
  )
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const [sportFilter, setSportFilter] = useState<SportFilter>("all")

  const [workouts, setWorkouts] = useState<any[]>([])
  const [nextWorkout, setNextWorkout] = useState<any>(null)

  const [autoStatus, setAutoStatus] = useState<"green" | "yellow" | "red">("green")
  const [autoStats, setAutoStats] = useState<{ total: number; done: number; pending: number; skipped: number }>({
    total: 0,
    done: 0,
    pending: 0,
    skipped: 0,
  })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login")
        return
      }

      setUid(user.uid)

      try {
        setLoading(true)

        // 1) user doc (solo para mostrar currentWeek si lo sigues usando)
        const userRef = doc(db, "users", user.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          setUserData(null)
          setWorkouts([])
          setNextWorkout(null)
          return
        }
        setUserData(userSnap.data())

        // 2) workouts de la semana
        const start = Timestamp.fromDate(weekStart)
        const endExclusive = Timestamp.fromDate(addDays(weekStart, 7))

        const workoutsRef = collection(db, "users", user.uid, "workouts")
        const weekQ = query(
          workoutsRef,
          where("date", ">=", start),
          where("date", "<", endExclusive),
          orderBy("date", "asc")
        )

        const weekSnap = await getDocs(weekQ)
        const weekWorkouts = weekSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

        // 3) estado automático instantáneo (sin subcolecciones)
        const { autoStatus: s, stats } = calcAutoStatus({ workouts: weekWorkouts })
        setAutoStatus(s)
        setAutoStats(stats)

        setWorkouts(weekWorkouts)

        // 4) próximo entreno (planned) desde ahora, respetando filtro
        const now = Timestamp.fromDate(new Date())
        const base = [
          where("date", ">=", now),
          where("status", "==", "planned"),
        ] as any[]

        const nextQ =
          sportFilter === "all"
            ? query(workoutsRef, ...base, orderBy("date", "asc"), limit(1))
            : query(
                workoutsRef,
                ...base,
                where("sport", "==", sportFilter),
                orderBy("date", "asc"),
                limit(1)
              )

        const nextSnap = await getDocs(nextQ)
        setNextWorkout(
          nextSnap.empty
            ? null
            : { id: nextSnap.docs[0].id, ...nextSnap.docs[0].data() }
        )
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [router, weekStart, sportFilter])

  if (loading) return <p className="p-6">Cargando dashboard...</p>

  if (!userData) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">ENDURIA</h1>
        <p className="text-red-600">
          Este usuario ha iniciado sesión, pero no tiene documento en Firestore (users/{`{uid}`}).
        </p>
        <p className="text-sm text-gray-600">
          Solución: registra el usuario desde /register o crea el doc manualmente.
        </p>
      </div>
    )
  }

  const todayKey = ymd(new Date())

  // Filtro deporte (para mostrar en semana)
  const filteredWorkouts =
    sportFilter === "all"
      ? workouts
      : workouts.filter((w) => w.sport === sportFilter)

  // Agrupar por día
  const byDay: Record<string, any[]> = {}
  for (const w of filteredWorkouts) {
    const dt: Date | null = w?.date?.toDate ? w.date.toDate() : null
    if (!dt) continue
    const key = ymd(dt)
    byDay[key] = byDay[key] || []
    byDay[key].push(w)
  }

  // ordenar dentro del día por hora
  for (const key of Object.keys(byDay)) {
    byDay[key].sort((a, b) => {
      const da = a?.date?.toDate ? a.date.toDate().getTime() : 0
      const dbt = b?.date?.toDate ? b.date.toDate().getTime() : 0
      return da - dbt
    })
  }

  const autoStatusLabel =
    autoStatus === "green" ? "🟢 Verde" : autoStatus === "yellow" ? "🟡 Amarillo" : "🔴 Rojo"

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">ENDURIA</h1>

        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={() => router.push("/workout/new")}
        >
          ➕ Crear entreno
        </button>
      </div>

      {/* Cards top */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Semana</div>
          <div className="text-lg">
            <strong>{userData.currentWeek}</strong>
          </div>
          <div className="text-sm opacity-70">{fmtRange(weekDays[0], weekDays[6])}</div>
        </div>

        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Estado (automático)</div>
          <div className="text-lg">
            <strong>{autoStatusLabel}</strong>
          </div>
          <div className="text-xs opacity-60 mt-1">
            Hecho {autoStats.done}/{autoStats.total} · Pend {autoStats.pending} · Salt {autoStats.skipped}
          </div>
          <div className="text-[11px] opacity-50 mt-1">
            (Basado en progreso + lastCheckinSummary)
          </div>
        </div>

        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Filtro</div>
          <div className="text-lg">
            <strong>
              {sportFilter === "all" && "Todos"}
              {sportFilter === "run" && "🏃 Running"}
              {sportFilter === "bike" && "🚴 Ciclismo"}
              {sportFilter === "strength" && "🏋️ Fuerza"}
            </strong>
          </div>
          <div className="text-xs opacity-60 mt-1">
            Afecta a la vista semanal y al “próximo entreno”.
          </div>
        </div>
      </div>

      {/* Week controls + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="border rounded px-3 py-2" onClick={() => setWeekStart((d) => addDays(d, -7))}>
            ⬅️ Semana anterior
          </button>

          <button className="border rounded px-3 py-2" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            🏠 Semana actual
          </button>

          <button className="border rounded px-3 py-2" onClick={() => setWeekStart((d) => addDays(d, 7))}>
            Semana siguiente ➡️
          </button>

          <div className="text-sm opacity-70 ml-2">{fmtRange(weekDays[0], weekDays[6])}</div>
        </div>

        {/* Filtro deporte */}
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "Todos"],
            ["run", "🏃 Run"],
            ["bike", "🚴 Bike"],
            ["strength", "🏋️ Strength"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`border rounded px-3 py-2 ${
                sportFilter === k ? "bg-black text-white" : ""
              }`}
              onClick={() => setSportFilter(k as SportFilter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly view */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((d) => {
          const key = ymd(d)
          const dayWorkouts = byDay[key] || []
          const isToday = key === todayKey

          return (
            <div
              key={key}
              className={`rounded p-3 space-y-2 ${
                isToday ? "border-2 border-black" : "border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold opacity-70">{fmtDayLabel(d)}</div>
                {isToday && <div className="text-xs font-semibold">HOY</div>}
              </div>

              {dayWorkouts.length === 0 && (
                <div className="text-sm opacity-40">—</div>
              )}

              {dayWorkouts.map((w) => (
                <div
                  key={w.id}
                  className={`rounded p-2 cursor-pointer hover:opacity-90 ${cardClassForStatus(
                    w.status
                  )}`}
                  onClick={() => router.push(`/workout/${w.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {w.title ?? "Entreno"}
                      </div>

                      <div className="flex items-center justify-between text-xs opacity-70 mt-1">
                        <span>
                          {w.sport ?? ""}
                          {w.duration ? ` · ${w.duration}’` : ""}
                        </span>
                        <span>{intensityLabel(w.intensity)}</span>
                      </div>

                      {/* Summary mini (si existe) */}
                      {w.lastCheckinSummary && (
                        <div className="text-[11px] opacity-70 mt-2">
                          RPE: <strong>{w.lastCheckinSummary.rpe ?? "—"}</strong>{" "}
                          · Fat: <strong>{w.lastCheckinSummary.fatigue ?? "—"}</strong>{" "}
                          {w.lastCheckinSummary.pain?.hasPain ? (
                            <>
                              · Dolor:{" "}
                              <strong>{w.lastCheckinSummary.pain?.intensity ?? "—"}</strong>
                            </>
                          ) : (
                            <>
                              · Dolor: <strong>No</strong>
                            </>
                          )}
                        </div>
                      )}

                      <div className="mt-2 inline-flex items-center gap-2 text-[11px] opacity-80 border rounded px-2 py-1">
                        <span>{statusBadge(w.status)}</span>
                        <span>{statusPillText(w.status)}</span>
                      </div>
                    </div>

                    <div className="text-lg">{statusBadge(w.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Next workout */}
      {nextWorkout ? (
        <div
          className="border rounded p-4 cursor-pointer hover:opacity-90"
          onClick={() => router.push(`/workout/${nextWorkout.id}`)}
        >
          <p className="font-semibold">Próximo entreno</p>
          <p>{nextWorkout.title}</p>
          <p className="text-sm text-gray-500">
            {nextWorkout.sport} · {intensityLabel(nextWorkout.intensity)}
          </p>
        </div>
      ) : (
        <div className="border rounded p-4">
          <p className="font-semibold">No hay entrenos pendientes</p>
          <p className="text-sm text-gray-500">
            Crea entrenos en <code>/workout/new</code> para verlos aquí.
          </p>
        </div>
      )}

      {/* Debug (opcional) */}
      <div className="text-xs opacity-40">
        UID: {uid ?? "—"} · Workouts semana: {workouts.length} · Mostrados: {filteredWorkouts.length}
      </div>
    </div>
  )
}
